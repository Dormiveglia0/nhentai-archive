package main

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type exportComicInfo struct {
	XMLName     xml.Name `xml:"ComicInfo"`
	Title       string   `xml:"Title,omitempty"`
	Series      string   `xml:"Series,omitempty"`
	Writer      string   `xml:"Writer,omitempty"`
	Publisher   string   `xml:"Publisher,omitempty"`
	Genre       string   `xml:"Genre,omitempty"`
	Tags        string   `xml:"Tags,omitempty"`
	LanguageISO string   `xml:"LanguageISO,omitempty"`
	PageCount   int      `xml:"PageCount,omitempty"`
}

func (a *App) writeExportArchive(target string, work Work) (int64, error) {
	info, err := a.exportComicInfo(work)
	if err != nil {
		return 0, err
	}
	payload, err := marshalComicInfo(info)
	if err != nil {
		return 0, err
	}
	if err := rewriteCBZWithComicInfo(work.ArchivePath, target, payload); err != nil {
		return 0, err
	}
	stat, err := os.Stat(target)
	if err != nil {
		return 0, err
	}
	return stat.Size(), nil
}

func (a *App) exportComicInfo(work Work) (exportComicInfo, error) {
	values := map[string]string{}
	rows, err := a.db.Query("SELECT field,COALESCE(current_value,'') FROM metadata_records WHERE work_id=?", work.ID)
	if err != nil {
		return exportComicInfo{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var field, value string
		if err := rows.Scan(&field, &value); err != nil {
			return exportComicInfo{}, err
		}
		values[strings.ToLower(strings.TrimSpace(field))] = strings.TrimSpace(value)
	}
	if err := rows.Err(); err != nil {
		return exportComicInfo{}, err
	}

	tags := a.exportTags(work.ID)
	pageCount := work.Pages
	if value := values["pagecount"]; value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			pageCount = parsed
		}
	}
	return exportComicInfo{
		Title:       firstNonEmpty(values["title"], work.Title),
		Series:      firstNonEmpty(values["series"], work.OriginalTitle),
		Writer:      firstNonEmpty(values["writer"], work.Author),
		Publisher:   firstNonEmpty(values["publisher"], work.Circle),
		Genre:       strings.Join(tags["category"], ", "),
		Tags:        strings.Join(tags["tag"], ", "),
		LanguageISO: firstNonEmpty(values["languageiso"], work.Language),
		PageCount:   pageCount,
	}, nil
}

func (a *App) exportTags(workID int) map[string][]string {
	out := map[string][]string{"tag": []string{}, "category": []string{}}
	rows, err := a.db.Query("SELECT kind,value FROM work_tags WHERE work_id=? AND confirmed=1 ORDER BY kind,value", workID)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var kind, value string
		if err := rows.Scan(&kind, &value); err != nil {
			continue
		}
		kind = strings.TrimSpace(kind)
		value = strings.TrimSpace(value)
		if value == "" {
			continue
		}
		if kind == "category" {
			out["category"] = append(out["category"], value)
			continue
		}
		if kind == "tag" || kind == "character" || kind == "parody" || kind == "group" || kind == "artist" || kind == "author" || kind == "circle" {
			out["tag"] = append(out["tag"], value)
		}
	}
	return out
}

func marshalComicInfo(info exportComicInfo) ([]byte, error) {
	body, err := xml.MarshalIndent(info, "", "  ")
	if err != nil {
		return nil, err
	}
	return append([]byte(xml.Header), body...), nil
}

func rewriteCBZWithComicInfo(source, target string, comicInfoXML []byte) error {
	reader, err := zip.OpenReader(source)
	if err != nil {
		return err
	}
	defer reader.Close()

	out, err := os.Create(target)
	if err != nil {
		return err
	}
	defer out.Close()

	writer := zip.NewWriter(out)
	defer writer.Close()

	for _, entry := range reader.File {
		if strings.EqualFold(filepath.Base(cleanSlash(entry.Name)), "ComicInfo.xml") {
			continue
		}
		if err := copyZipEntry(writer, entry); err != nil {
			return err
		}
	}
	return addZipText(writer, "ComicInfo.xml", comicInfoXML)
}

func copyZipEntry(writer *zip.Writer, entry *zip.File) error {
	header := entry.FileHeader
	header.Name = cleanSlash(header.Name)
	if header.Name == "" {
		return nil
	}
	target, err := writer.CreateHeader(&header)
	if err != nil {
		return err
	}
	if entry.FileInfo().IsDir() {
		return nil
	}
	source, err := entry.Open()
	if err != nil {
		return err
	}
	defer source.Close()
	_, err = io.Copy(target, source)
	return err
}

func addZipText(writer *zip.Writer, name string, data []byte) error {
	header := &zip.FileHeader{Name: name, Method: zip.Deflate}
	header.SetMode(0o644)
	out, err := writer.CreateHeader(header)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, bytes.NewReader(data))
	return err
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
