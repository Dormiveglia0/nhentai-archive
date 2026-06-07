package main

type Work struct {
	ID            int      `json:"id"`
	Title         string   `json:"title"`
	OriginalTitle string   `json:"originalTitle"`
	Circle        string   `json:"circle"`
	Author        string   `json:"author"`
	Source        string   `json:"source"`
	SourceID      string   `json:"sourceId"`
	Pages         int      `json:"pages"`
	Size          string   `json:"size"`
	Language      string   `json:"language"`
	Cover         string   `json:"cover"`
	Progress      int      `json:"progress"`
	MetadataScore int      `json:"metadataScore"`
	Tags          []string `json:"tags"`
	Status        string   `json:"status"`
	ArchivePath   string   `json:"-"`
	CoverPath     string   `json:"-"`
}

type Gallery struct {
	Work
	Imported bool  `json:"imported"`
	Related  []int `json:"related"`
}

type Task struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Title    string `json:"title"`
	Target   string `json:"target"`
	Phase    string `json:"phase"`
	Progress int    `json:"progress"`
	Status   string `json:"status"`
	ETA      string `json:"eta"`
}

type DictionaryTerm struct {
	ID         int      `json:"id"`
	Source     string   `json:"source"`
	ZH         string   `json:"zh"`
	Aliases    []string `json:"aliases"`
	Type       string   `json:"type"`
	Works      int      `json:"works"`
	Hits       int      `json:"hits"`
	Status     string   `json:"status"`
	Confidence int      `json:"confidence"`
}

type ExportJob struct {
	ID       int      `json:"id"`
	WorkID   int      `json:"workId"`
	Filename string   `json:"filename"`
	Size     string   `json:"size"`
	Preset   string   `json:"preset"`
	Status   string   `json:"status"`
	Warnings []string `json:"warnings"`
}

type SettingsState struct {
	APIConnected bool   `json:"apiConnected"`
	Privacy      bool   `json:"privacy"`
	BlurCovers   bool   `json:"blurCovers"`
	CacheLimit   string `json:"cacheLimit"`
	Theme        string `json:"theme"`
	DataDir      string `json:"dataDir"`
	ExportDir    string `json:"exportDir"`
}

type AppState struct {
	Works      []Work           `json:"works"`
	Galleries  []Gallery        `json:"galleries"`
	Tasks      []Task           `json:"tasks"`
	Dictionary []DictionaryTerm `json:"dictionary"`
	Exports    []ExportJob      `json:"exports"`
	Settings   SettingsState    `json:"settings"`
}

type ReaderPage struct {
	Index int    `json:"index"`
	Name  string `json:"name"`
	URL   string `json:"url"`
}

type ProgressState struct {
	PageIndex int `json:"pageIndex"`
	Percent   int `json:"percent"`
}

type ReaderManifest struct {
	Work     Work          `json:"work"`
	Pages    []ReaderPage  `json:"pages"`
	Progress ProgressState `json:"progress"`
}

type MetadataRecord struct {
	Field        string `json:"field"`
	CurrentValue string `json:"currentValue"`
	SourceValue  string `json:"sourceValue"`
	MachineValue string `json:"machineValue"`
	Status       string `json:"status"`
}

type MetadataPayload struct {
	Work    Work                `json:"work"`
	Records []MetadataRecord    `json:"records"`
	Tags    map[string][]string `json:"tags"`
}

type SetupStatus struct {
	NeedsSetup bool `json:"needs_setup"`
}

type AuthResponse struct {
	Token    string `json:"token"`
	Username string `json:"username"`
}

type FileHealth struct {
	Archives      int   `json:"archives"`
	Pages         int   `json:"pages"`
	MissingCovers int   `json:"missingCovers"`
	Bytes         int64 `json:"bytes"`
}
