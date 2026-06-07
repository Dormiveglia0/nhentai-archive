package main

import (
	"archive/zip"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	maxArchiveBytes     = 2 << 30
	maxArchiveEntries   = 2000
	maxCoverBytes       = 32 << 20
	maxComicInfoBytes   = 1 << 20
)

type comicInfo struct {
	Title       string `xml:"Title"`
	Series      string `xml:"Series"`
	Writer      string `xml:"Writer"`
	Publisher   string `xml:"Publisher"`
	Genre       string `xml:"Genre"`
	Tags        string `xml:"Tags"`
	LanguageISO string `xml:"LanguageISO"`
	PageCount   int    `xml:"PageCount"`
}

type parsedArchive struct {
	Info      comicInfo
	Pages     []string
	SizeBytes int64
	Hash      string
}

func (a *App) importUploadedArchive(file io.Reader, originalName string) (Work, error) {
	if err := os.MkdirAll(filepath.Join(a.cfg.LibraryDir, "originals"), 0o755); err != nil {
		return Work{}, err
	}
	target := filepath.Join(a.cfg.LibraryDir, "originals", sanitizeFilename(originalName))
	target = a.availablePath(target)
	out, err := os.Create(target)
	if err != nil {
		return Work{}, err
	}
	hasher := sha256.New()
	limited := io.LimitReader(file, maxArchiveBytes+1)
	size, copyErr := io.Copy(io.MultiWriter(out, hasher), limited)
	closeErr := out.Close()
	if copyErr != nil {
		_ = os.Remove(target)
		return Work{}, copyErr
	}
	if closeErr != nil {
		_ = os.Remove(target)
		return Work{}, closeErr
	}
	if size > maxArchiveBytes {
		_ = os.Remove(target)
		return Work{}, errors.New("archive is too large")
	}
	work, err := a.importLocalArchive(target)
	if err != nil {
		_ = os.Remove(target)
		return Work{}, err
	}
	_, _ = a.db.Exec("UPDATE work_files SET size_bytes=?,file_hash=? WHERE work_id=? AND kind='archive'", size, hex.EncodeToString(hasher.Sum(nil)), work.ID)
	refreshed, ok := a.work(work.ID)
	if !ok {
		return Work{}, errors.New("imported work disappeared")
	}
	return refreshed, nil
}

func (a *App) importLocalArchive(path string) (Work, error) {
	parsed, err := parseCBZ(path)
	if err != nil {
		return Work{}, err
	}
	if existing, ok := a.workByArchiveHash(parsed.Hash); ok {
		return existing, nil
	}
	title := strings.TrimSpace(parsed.Info.Title)
	if title == "" {
		title = strings.TrimSuffix(filepath.Base(path), filepath.Ext(path))
	}
	language := valueOr(parsed.Info.LanguageISO, "unknown")
	status := "needs_metadata"
	metadataScore := 45
	if parsed.Info.Title != "" && parsed.Info.Writer != "" && parsed.Info.Tags != "" {
		metadataScore = 78
	}
	tx, err := a.db.Begin()
	if err != nil {
		return Work{}, err
	}
	workID, err := insertWork(tx, title, parsed.Info, path, parsed.SizeBytes, len(parsed.Pages), language, metadataScore, status)
	if err != nil {
		_ = tx.Rollback()
		return Work{}, err
	}
	if _, err := tx.Exec("INSERT INTO work_files(work_id,kind,path,size_bytes,file_hash) VALUES(?,?,?,?,?)", workID, "archive", path, parsed.SizeBytes, parsed.Hash); err != nil {
		_ = tx.Rollback()
		return Work{}, err
	}
	for index, name := range parsed.Pages {
		if _, err := tx.Exec("INSERT INTO work_pages(work_id,page_index,name) VALUES(?,?,?)", workID, index+1, name); err != nil {
			_ = tx.Rollback()
			return Work{}, err
		}
	}
	for kind, values := range archiveTags(parsed.Info) {
		for _, value := range values {
			if _, err := tx.Exec("INSERT INTO work_tags(work_id,kind,value,confirmed) VALUES(?,?,?,?)", workID, kind, value, 0); err != nil {
				_ = tx.Rollback()
				return Work{}, err
			}
		}
	}
	for _, record := range recordsFromComicInfo(parsed.Info, len(parsed.Pages), title) {
		if _, err := tx.Exec("INSERT INTO metadata_records(work_id,field,current_value,source_value,machine_value,status) VALUES(?,?,?,?,?,?)", workID, record.Field, record.CurrentValue, record.SourceValue, record.MachineValue, record.Status); err != nil {
			_ = tx.Rollback()
			return Work{}, err
		}
	}
	if err := tx.Commit(); err != nil {
		return Work{}, err
	}
	coverPath := ""
	if len(parsed.Pages) > 0 {
		coverPath, _ = a.extractCover(path, workID, parsed.Pages[0])
	}
	if coverPath != "" {
		_, _ = a.db.Exec("UPDATE works SET cover_path=? WHERE id=?", coverPath, workID)
	}
	work, ok := a.work(workID)
	if !ok {
		return Work{}, errors.New("imported work disappeared")
	}
	return work, nil
}

func (a *App) workByArchiveHash(hash string) (Work, bool) {
	var id int
	err := a.db.QueryRow("SELECT work_id FROM work_files WHERE file_hash=? ORDER BY id LIMIT 1", hash).Scan(&id)
	if err != nil {
		return Work{}, false
	}
	return a.work(id)
}

func insertWork(tx *sql.Tx, title string, info comicInfo, archivePath string, sizeBytes int64, pages int, language string, metadataScore int, status string) (int, error) {
	result, err := tx.Exec(`INSERT INTO works(title,original_title,circle,author,source,source_id,pages,size_bytes,language,archive_path,metadata_score,status)
VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, title, info.Series, info.Publisher, info.Writer, "local_cbz", "", pages, sizeBytes, language, archivePath, metadataScore, status)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	return int(id), err
}

func parseCBZ(path string) (parsedArchive, error) {
	stat, err := os.Stat(path)
	if err != nil {
		return parsedArchive{}, err
	}
	if stat.Size() > maxArchiveBytes {
		return parsedArchive{}, errors.New("archive is too large")
	}
	reader, err := zip.OpenReader(path)
	if err != nil {
		return parsedArchive{}, err
	}
	defer reader.Close()
	if len(reader.File) > maxArchiveEntries {
		return parsedArchive{}, errors.New("archive contains too many entries")
	}
	info := comicInfo{}
	pages := []string{}
	hasher := sha256.New()
	file, err := os.Open(path)
	if err == nil {
		_, _ = io.Copy(hasher, file)
		_ = file.Close()
	}
	for _, entry := range reader.File {
		name := cleanSlash(entry.Name)
		if name == "" || entry.FileInfo().IsDir() {
			continue
		}
		if strings.EqualFold(filepath.Base(name), "ComicInfo.xml") {
			_ = readComicInfo(entry, &info)
			continue
		}
		if isImageName(name) {
			pages = append(pages, name)
		}
	}
	sort.Slice(pages, func(i, j int) bool {
		return naturalLess(pages[i], pages[j])
	})
	if len(pages) == 0 {
		return parsedArchive{}, errors.New("archive contains no image pages")
	}
	return parsedArchive{Info: info, Pages: pages, SizeBytes: stat.Size(), Hash: hex.EncodeToString(hasher.Sum(nil))}, nil
}

func readComicInfo(entry *zip.File, info *comicInfo) error {
	rc, err := entry.Open()
	if err != nil {
		return err
	}
	defer rc.Close()
	return xml.NewDecoder(io.LimitReader(rc, maxComicInfoBytes)).Decode(info)
}

func isImageName(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif":
		return true
	default:
		return false
	}
}

func archiveTags(info comicInfo) map[string][]string {
	out := map[string][]string{}
	if info.Writer != "" {
		out["author"] = []string{info.Writer}
	}
	if info.Publisher != "" {
		out["circle"] = []string{info.Publisher}
	}
	out["tag"] = splitTagList(info.Tags)
	if info.Genre != "" {
		out["category"] = splitTagList(info.Genre)
	}
	if info.LanguageISO != "" {
		out["language"] = []string{info.LanguageISO}
	}
	return out
}

func splitTagList(value string) []string {
	value = strings.ReplaceAll(value, ";", ",")
	parts := strings.Split(value, ",")
	return uniqueStrings(parts)
}

func recordsFromComicInfo(info comicInfo, pages int, title string) []MetadataRecord {
	pageCount := info.PageCount
	if pageCount == 0 {
		pageCount = pages
	}
	return []MetadataRecord{
		{Field: "Title", CurrentValue: title, SourceValue: valueOr(info.Title, title), MachineValue: valueOr(info.Title, title), Status: "same"},
		{Field: "Series", CurrentValue: info.Series, SourceValue: info.Series, MachineValue: info.Series, Status: "same"},
		{Field: "Writer", CurrentValue: info.Writer, SourceValue: info.Writer, MachineValue: info.Writer, Status: "same"},
		{Field: "Publisher", CurrentValue: info.Publisher, SourceValue: info.Publisher, MachineValue: info.Publisher, Status: "same"},
		{Field: "LanguageISO", CurrentValue: info.LanguageISO, SourceValue: info.LanguageISO, MachineValue: info.LanguageISO, Status: "same"},
		{Field: "PageCount", CurrentValue: fmt.Sprintf("%d", pageCount), SourceValue: fmt.Sprintf("%d", pageCount), MachineValue: fmt.Sprintf("%d", pages), Status: "same"},
		{Field: "Tags", CurrentValue: info.Tags, SourceValue: info.Tags, MachineValue: info.Tags, Status: "review"},
	}
}

func (a *App) extractCover(archivePath string, workID int, entryName string) (string, error) {
	if err := os.MkdirAll(filepath.Join(a.cfg.LibraryDir, "covers"), 0o755); err != nil {
		return "", err
	}
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	var entry *zip.File
	for _, item := range reader.File {
		if cleanSlash(item.Name) == entryName {
			entry = item
			break
		}
	}
	if entry == nil {
		return "", errors.New("cover entry missing")
	}
	if entry.FileInfo().Size() > maxCoverBytes {
		return "", errors.New("cover entry is too large")
	}
	rc, err := entry.Open()
	if err != nil {
		return "", err
	}
	defer rc.Close()
	coverPath := filepath.Join(a.cfg.LibraryDir, "covers", intString(workID)+strings.ToLower(filepath.Ext(entryName)))
	out, err := os.Create(coverPath)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(out, io.LimitReader(rc, maxCoverBytes+1)); err != nil {
		_ = out.Close()
		return "", err
	}
	return coverPath, out.Close()
}

func (a *App) streamArchivePage(w io.Writer, workID, pageIndex int) (string, error) {
	var archivePath, entryName string
	err := a.db.QueryRow("SELECT w.archive_path,p.name FROM works w JOIN work_pages p ON p.work_id=w.id WHERE w.id=? AND p.page_index=?", workID, pageIndex).Scan(&archivePath, &entryName)
	if err != nil {
		return "", err
	}
	reader, err := zip.OpenReader(archivePath)
	if err != nil {
		return "", err
	}
	defer reader.Close()
	for _, entry := range reader.File {
		if cleanSlash(entry.Name) != entryName {
			continue
		}
		rc, err := entry.Open()
		if err != nil {
			return "", err
		}
		defer rc.Close()
		_, err = io.Copy(w, rc)
		return entryName, err
	}
	return "", errors.New("page not found")
}

func (a *App) availablePath(path string) string {
	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	for i := 0; ; i++ {
		candidate := path
		if i > 0 {
			candidate = fmt.Sprintf("%s-%d%s", base, i+1, ext)
		}
		if _, err := os.Stat(candidate); os.IsNotExist(err) {
			return candidate
		}
	}
}

func naturalLess(a, b string) bool {
	aa := splitNatural(a)
	bb := splitNatural(b)
	for i := 0; i < len(aa) && i < len(bb); i++ {
		if aa[i] == bb[i] {
			continue
		}
		ai, aErr := parsePositiveInt(aa[i])
		bi, bErr := parsePositiveInt(bb[i])
		if aErr == nil && bErr == nil {
			return ai < bi
		}
		return aa[i] < bb[i]
	}
	return len(aa) < len(bb)
}

func splitNatural(value string) []string {
	value = strings.ToLower(value)
	parts := []string{}
	current := strings.Builder{}
	wasDigit := false
	for _, r := range value {
		isDigit := r >= '0' && r <= '9'
		if current.Len() > 0 && isDigit != wasDigit {
			parts = append(parts, current.String())
			current.Reset()
		}
		current.WriteRune(r)
		wasDigit = isDigit
	}
	if current.Len() > 0 {
		parts = append(parts, current.String())
	}
	return parts
}
