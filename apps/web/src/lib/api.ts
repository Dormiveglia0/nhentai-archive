export type GallerySummary = {
  remote: "nhentai";
  gallery_id: number;
  media_id?: string;
  title: string;
  title_japanese?: string;
  pretty_title?: string;
  thumbnail: { path?: string; url?: string; width?: number; height?: number };
  page_count: number;
  favorites: number;
  tag_ids: number[];
  tags?: Array<{ id: number; type?: string; name?: string; slug?: string; display?: string }>;
  blacklisted: boolean;
  imported?: boolean;
  work_id?: number | null;
};

export type GalleryDetail = {
  gallery_id: number;
  media_id?: string;
  title: { english?: string; japanese?: string; pretty?: string };
  cover?: { path?: string; url?: string; width?: number; height?: number };
  thumbnail?: { path?: string; url?: string; width?: number; height?: number };
  tags: Array<{ id: number; type: string; name: string; slug: string; display?: string }>;
  page_count: number;
  pages?: Array<{ index?: number; path?: string; url?: string; width?: number; height?: number }>;
  favorites: number;
  upload_date?: number | string | null;
  related: GallerySummary[];
  imported: boolean;
  work_id?: number | null;
};

export type RemoteTag = {
  id: number;
  type?: string;
  name?: string;
  slug?: string;
  count?: number;
  display?: string;
  source?: string;
  dictionary_id?: number | null;
};

export type DictionaryTerm = {
  id: number;
  original_text: string;
  zh_name: string;
  tag_type: string;
  remote_tag_id?: number | null;
  aliases?: string[];
  scope: string[];
  note?: string | null;
  status: string;
  confidence: number;
  locked: boolean;
  ignored: boolean;
  source: string;
};

export type DictionaryCandidate = Omit<RemoteTag, "id"> & {
  id?: number | null;
  dictionary_id?: number | null;
  status?: string | null;
  configured?: boolean;
  ignored?: boolean;
  impact_work_count?: number;
};

export type DictionaryApplyPayload = {
  original_text: string;
  zh_name: string;
  tag_type: string;
  remote_tag_id?: number | null;
  aliases?: string[];
  scope?: string[];
  note?: string | null;
  status?: string;
  confidence?: number;
  locked?: boolean;
  ignored?: boolean;
};

export type DictionaryPreview = {
  writes: boolean;
  dictionary: DictionaryApplyPayload & { normalized_key?: string };
  impact: { work_count: number; work_ids: number[]; tag_count: number };
  will_update_tags: number;
  will_update_works: number;
  ignored: number;
  samples: Work[];
  conflicts: Array<{ type: string; message: string; id?: number; dictionary_id?: number }>;
};

export type DictionaryApplyResult = {
  dictionary: DictionaryTerm;
  impact: DictionaryPreview["impact"];
  conflicts: DictionaryPreview["conflicts"];
};

export type DictionaryStatusResult = {
  dictionary: DictionaryTerm;
};

export type DictionaryDeleteResult = {
  deleted: boolean;
  dictionary_id: number;
};

export type BulkImportRow = {
  original_text: string;
  zh_name: string;
  tag_type?: string;
  aliases?: string[] | string;
  remote_tag_id?: number | null;
  note?: string | null;
};

export type BulkImportPreview = {
  writes?: boolean;
  summary: { valid?: number; duplicate?: number; conflict?: number; invalid?: number; imported?: number };
  rows: Array<{ index: number; status: "valid" | "duplicate" | "conflict" | "invalid"; message: string; payload: DictionaryApplyPayload }>;
};

export type DictionarySummary = {
  unconfigured: number;
  configured: number;
  ignored: number;
  review: number;
  suggestions: number;
};

export type DictionaryEvidence = {
  remote_tag: null | { id: number; type?: string; name?: string; slug?: string };
  dictionary: DictionaryTerm | null;
  related_works: Work[];
  co_tags: Array<{ id: number; display: string; type?: string; count: number }>;
  history: Array<{ status: string; source: string; updated_at: string; message: string }>;
};

export type Work = {
  id: number;
  remote?: string;
  remote_gallery_id?: number;
  title: string;
  title_japanese?: string;
  pretty_title?: string;
  source: string;
  page_count: number;
  cover_path?: string;
  progress_percent?: number;
  reader_page_index?: number;
  completed?: number;
};

export type LibraryTag = {
  id: number | null;
  key?: string;
  type?: string;
  name?: string;
  slug?: string;
  display: string;
};

export type LibraryWork = Work & {
  display_title?: string | null;
  metadata_gallery_id?: number | null;
  favorite: boolean;
  language?: string | null;
  media_id?: string | null;
  created_at?: string;
  updated_at?: string;
  last_read_at?: string | null;
  size_bytes?: number;
  tag_count?: number;
  tags?: LibraryTag[];
};

export type LibrarySummary = {
  total: number;
  favorites: number;
  reading: number;
  completed: number;
  unread: number;
  untagged: number;
  total_pages: number;
  total_size_bytes: number;
  sources: { remote: number; local: number };
  languages: Array<{ value: string; label: string; count: number }>;
};

export type ReadingHistoryEntry = {
  id: number;
  title: string;
  title_japanese?: string | null;
  pretty_title?: string | null;
  source: string;
  remote_gallery_id?: number | null;
  page_count: number;
  cover_path?: string | null;
  date: string;
  last_opened_at: string;
  read_events: number;
  furthest_page: number;
  progress_percent: number;
  completed: boolean;
};

export type ReadingHistoryPage = {
  result: ReadingHistoryEntry[];
  total: number;
  page: number;
  per_page: number;
  num_pages: number;
};

export type ReadingSession = {
  id: number;
  client_key: string;
  work_id?: number | null;
  gallery_id?: number | null;
  started_at: string;
  updated_at: string;
  ended_at?: string | null;
  duration_seconds: number;
  last_page_index: number;
};

export type ReadingWorkRank = Pick<LibraryWork, "id" | "title" | "title_japanese" | "pretty_title" | "cover_path" | "favorite"> & {
  source: "local" | "remote";
  work_id?: number | null;
  remote_gallery_id?: number | null;
  reading_seconds: number;
  reading_sessions: number;
};

export type ReadingTagRank = {
  id?: number | null;
  display: string;
  work_count: number;
  share_percent: number;
  favorite_count: number;
  reading_seconds: number;
  reading_sessions: number;
};

export type ReadingSessionRank = {
  id: number;
  source: "local" | "remote";
  work_id?: number | null;
  remote_gallery_id?: number | null;
  title: string;
  title_japanese?: string | null;
  pretty_title?: string | null;
  started_at: string;
  duration_seconds: number;
  last_page_index: number;
};

export type ReadingStatistics = {
  period_days: number;
  timezone_offset_minutes: number;
  period: {
    start_date: string;
    end_date: string;
    previous_total_seconds: number;
    previous_sessions: number;
    seconds_change_percent?: number | null;
  };
  overview: {
    total_seconds: number;
    sessions: number;
    works_read: number;
    favorite_count: number;
    active_days: number;
    current_streak_days: number;
    average_session_seconds: number;
    longest_session_seconds: number;
    tracking_since?: string | null;
    all_time_seconds: number;
    all_time_sessions: number;
    all_time_works_read: number;
  };
  activity: Array<{ date: string; seconds: number; sessions: number; works: number }>;
  weekdays: Array<{ weekday: number; seconds: number; sessions: number }>;
  hours: Array<{ hour: number; seconds: number; sessions: number }>;
  top_by_time: ReadingWorkRank[];
  top_by_sessions: ReadingWorkRank[];
  recent_sessions: ReadingSessionRank[];
  collection_total_works: number;
  top_authors: ReadingTagRank[];
  top_tags: ReadingTagRank[];
};

export type LibraryTagFilter = {
  id: number | null;
  key?: string;
  type?: string;
  name?: string;
  slug?: string;
  display: string;
  dictionary_id?: number | null;
  count: number;
};

export type LibrarySearchParams = {
  library_id?: number;
  q?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  read_status?: string;
  source?: string;
  language?: string;
  tag_ids?: number[];
  tag_keys?: string[];
  favorite_only?: boolean;
};

export type LibrarySearchResult = {
  result: LibraryWork[];
  total: number;
  page: number;
  per_page: number;
  num_pages: number;
  revision: number;
};

export type GovernanceReason = {
  code: string;
  label: string;
  detail?: string;
  severity: "warning" | "danger" | string;
};

export type GovernanceReviewState = "unreviewed" | "stale" | "approved";

export type GovernanceReview = {
  state: GovernanceReviewState;
  reviewed_at?: string | null;
  note?: string | null;
  history?: Array<{
    action: "approve" | "reopen" | string;
    note?: string | null;
    created_at?: string | null;
  }>;
};

export type GovernanceQueueItem = {
  work: LibraryWork;
  reasons: GovernanceReason[];
  review: GovernanceReview;
  completeness_percent: number;
  updated_at?: string | null;
};

export type GovernanceQueue = {
  result: GovernanceQueueItem[];
  summary: {
    total: number;
    unreviewed: number;
    stale: number;
    approved: number;
    automatic_issues: number;
    missing_metadata: number;
    untagged: number;
    dictionary_unmapped: number;
    dictionary_review: number;
    dictionary_conflict: number;
    missing_source: number;
    missing_comicinfo: number;
    missing_cover: number;
  };
};

export type MetadataFieldDiff = {
  field: string;
  label: string;
  current_value?: string | null;
  source_value?: string | null;
  source: "comicinfo" | "json" | "remote" | "unknown" | string;
  working_value?: string | null;
  working_source: "manual" | "remote" | "comicinfo" | "current" | string;
  dirty: boolean;
  differs_from_source: boolean;
  updated_at?: string | null;
};

export type GovernanceFile = {
  id: number;
  kind: string;
  path: string;
  size_bytes: number;
  sha256?: string | null;
  created_at?: string | null;
  exists: boolean;
  read_only?: boolean;
  library_name?: string | null;
};

export type GovernanceTag = {
  id: number;
  remote_tag_id?: number | null;
  dictionary_id?: number | null;
  type: string;
  name?: string | null;
  slug?: string | null;
  display: string;
  dictionary_status?: string | null;
  state: "confirmed" | "pending" | "conflict" | string;
};

export type GovernanceTagGroup = {
  key: string;
  label: string;
  tags: GovernanceTag[];
};

export type GovernanceAggregate = {
  work: LibraryWork;
  files: GovernanceFile[];
  metadata: { fields: MetadataFieldDiff[] };
  tags: { groups: GovernanceTagGroup[]; summary: { confirmed: number; preserved: number; unmapped: number; review: number; pending: number; conflicts: number } };
  dictionary: { matched: number; preserved: number; unmapped: number; review: number; pending: number; conflicts: number };
  exports: unknown[];
  automatic_issues: GovernanceReason[];
  checks: Array<{
    key: "metadata" | "dictionary" | "files" | string;
    label: string;
    description: string;
    status: "passed" | "warning" | "danger" | string;
    issues: GovernanceReason[];
  }>;
  review: GovernanceReview;
  recommended_actions: Array<{ code: string; label: string }>;
  completeness_percent: number;
};

export type GovernanceApplyPayload = {
  metadata: Array<{ field: string; value: string | null; source: "manual" | "remote" | "comicinfo" | "current" }>;
  dictionary_apply?: DictionaryApplyPayload[];
  write_back?: boolean;
};

export type GovernanceApplyResult = {
  saved: number;
  dictionary: DictionaryApplyResult[];
  governance: GovernanceAggregate;
  write_back?: {
    written?: boolean;
    fields?: Record<string, string>;
    new_size_bytes?: number;
    error?: string;
  };
};

export type GovernanceTranslateSuggestion = {
  field: string;
  label: string;
  original: string;
  suggestion: string;
};

export type GovernanceTranslateResult = {
  result: GovernanceTranslateSuggestion[];
  skipped: Array<{ field: string; label: string; reason: string }>;
  provider: string | null;
};

export type GovernanceReviewResult = {
  review: GovernanceReview;
  governance: GovernanceAggregate;
};

export type GovernanceBulkActions = {
  fill_missing_metadata?: boolean;
  write_back?: boolean;
  confirm_dictionary_terms?: boolean;
};

export type GovernanceBulkDictionaryTerm = {
  dictionary_id: number;
  original_text: string;
  zh_name: string;
  tag_type: string;
  status: string;
  reason?: string;
};

export type GovernanceBulkPreview = {
  result: Array<{
    work: LibraryWork;
    fill_fields: Array<{ field: string; label: string; source_value: string; source: string }>;
    write_back_ready: boolean;
    blockers: string[];
    dictionary_terms: GovernanceBulkDictionaryTerm[];
    skipped_dictionary_terms: GovernanceBulkDictionaryTerm[];
  }>;
  summary: {
    works: number;
    fields_to_fill: number;
    write_back_ready: number;
    dictionary_terms_to_confirm: number;
    dictionary_terms_skipped: number;
  };
};

export type GovernanceBulkResult = {
  result: Array<{
    work_id: number;
    filled: string[];
    write_back: { written?: boolean; error?: string } | null;
    dictionary_terms: GovernanceBulkDictionaryTerm[];
  }>;
  summary: {
    works: number;
    filled_fields: number;
    written: number;
    errors: number;
    dictionary_terms_confirmed: number;
    dictionary_terms_skipped: number;
  };
};

export type MetadataRefreshSource = "remote_id" | "web" | "manual_id" | "fuzzy";

export type MetadataRefreshMatch = {
  gallery_id: number;
  title: string;
  title_japanese?: string | null;
  pretty_title?: string | null;
  page_count: number;
  source: MetadataRefreshSource;
  confidence: number;
  margin: number;
  eligible: boolean;
  reason?: string | null;
  language?: string | null;
  automatic_eligible?: boolean;
  selectable?: boolean;
  thumbnail_url?: string | null;
  diffs?: Array<{ field: string; label: string; local: string | number | null; remote: string | number | null; changed: boolean; protected: boolean }>;
};

export type MetadataRefreshPreview = {
  result: Array<{
    work: Pick<LibraryWork, "id" | "title" | "source" | "remote_gallery_id" | "page_count">;
    match: MetadataRefreshMatch | null;
    reason?: string | null;
    version: string;
    query: string;
    config: { auto_bind: boolean; language_mode: "any" | "strict" | "prefer"; language: string };
    candidates: MetadataRefreshMatch[];
  }>;
  summary: {
    works: number;
    ready: number;
    exact: number;
    fuzzy: number;
    review: number;
    unmatched: number;
  };
};

export type MetadataRefreshResult = {
  result: Array<{
    work_id: number;
    gallery_id: number;
    status: "updated" | "skipped" | "error";
    reason?: string;
    tags?: number;
    removed_tags?: number;
  }>;
  summary: { works: number; updated: number; skipped: number; errors: number };
};

export type ExportBlocker = {
  code: string;
  message: string;
};

export type ExportWarning = {
  code: string;
  message: string;
};

export type ExportSourceFile = {
  path?: string | null;
  size_bytes: number;
  sha256?: string | null;
  exists: boolean;
};

export type ExportOptions = {
  write_comicinfo: boolean;
  keep_json: boolean;
  compress: boolean;
};

export type ExportPreview = {
  work: LibraryWork;
  source_file: ExportSourceFile;
  output_name: string;
  comic_info: Record<string, string>;
  options: ExportOptions;
  will_write: string[];
  will_keep: string[];
  will_not_modify: string[];
  blockers: ExportBlocker[];
  warnings: ExportWarning[];
};

export type ExportQueueItem = {
  work: LibraryWork;
  output_name: string;
  blockers: ExportBlocker[];
  warnings: ExportWarning[];
  source_file: ExportSourceFile;
};

export type ExportQueue = {
  result: ExportQueueItem[];
  summary: {
    total: number;
    ready: number;
    blocked: number;
    warnings: number;
  };
};

export type ExportSummaryStats = ExportQueue["summary"];

export type FileEntry = {
  kind: "work" | "orphan" | "stale";
  id: string;
  status: "ok" | "missing_source" | "missing_cover" | "orphan" | "stale";
  flags: string[];
  size_bytes: number;
  // work entries
  work_id?: number;
  title?: string;
  source_path?: string | null;
  cover_path?: string | null;
  page_count?: number;
  source?: string | null;
  remote_gallery_id?: number | null;
  updated_at?: string | null;
  tags?: string[];
  tag_items?: LibraryTag[];
  source_status?: string | null;
  library_id?: number | null;
  library_name?: string | null;
  read_only?: boolean;
  // loose entries
  path?: string;
  name?: string;
  dir?: string;
};

export type FileDuplicates = {
  hash: { groups: number; files: number };
  gallery_id: { groups: number; works: number };
  title_similar: number | null;
};

export type FileOverview = {
  work_count: number;
  source_bytes: number;
  cover_ok: number;
  missing_source: number;
  missing_cover: number;
  orphan_count: number;
  orphan_bytes: number;
  stale_count: number;
  stale_bytes: number;
  reclaimable_bytes: number;
};

export type FileInventory = { result: FileEntry[]; total: number; page: number; per_page: number };

export type FileDeleteTarget = { kind: "work" | "orphan" | "stale"; work_id?: number; path?: string };

export type FileDeletePreviewItem = {
  kind: string;
  work_id?: number;
  title?: string;
  path?: string;
  exists: boolean;
  files?: string[];
  work_tags?: number;
  has_progress?: boolean;
  has_governance?: boolean;
  reclaim_bytes: number;
  warnings: string[];
  status: string;
};

export type FileDeletePreview = {
  items: FileDeletePreviewItem[];
  files_to_delete: number;
  works_to_remove: number;
  reclaim_bytes: number;
};

export type FileDeleteResult = {
  deleted_files: number;
  removed_works: number;
  reclaimed_bytes: number;
  errors: { target: FileDeleteTarget; code: string; message: string }[];
};

export type FileInventoryParams = {
  category?: string;
  q?: string;
  status?: string;
  sort?: string;
  page?: number;
  per_page?: number;
};

export type ExportRequestOptions = {
  output_name?: string;
  write_comicinfo?: boolean;
  keep_json?: boolean;
  compress?: boolean;
};

export type ExportBatchItem = {
  work_id: number;
  output_name?: string;
};

export type PageInfo = {
  width?: number;
  height?: number;
  id?: number;
  work_id: number;
  page_index: number;
  archive_member: string;
  media_type: string;
  size_bytes: number;
};

export type ReaderBridgeStatus = {
  status: "unavailable" | "unverified" | "verifying" | "verified" | "incompatible" | "failed";
  enabled: boolean; eligible: boolean; reason?: string | null; version?: string; source_revision?: string; source_stamp?: string; job?: Job | null;
  pages: { page_index: number; width?: number; height?: number; url: string }[];
};

export type ReaderState = {
  work_id: number;
  page_index: number;
  page_count: number;
  progress_percent: number;
  completed: boolean;
  last_read_at: string | null;
};

export type ReadingSource = {
  source_stamp?: string;
  status: string;
  cache_id: number | null;
  lease: string | null;
  source_revision?: string | null;
  pages?: PageInfo[];
  job?: Job | null;
  error?: string | null;
};

export type JobMeta = {
  title?: string | null;
  page_count?: number | null;
  cover_url?: string | null;
};

export type BulkExportSkip = { work_id: number; reason: string };

export type LibraryScanSkip = { path: string; reason: string };

export interface LibraryScanPreview {
  new_linked: { path: string; gallery_id: number }[];
  new_local: { path: string; gallery_id: number | null }[];
  already_known: { path: string }[];
  unreadable: { path: string }[];
  counts: { new_linked: number; new_local: number; already_known: number; unreadable: number };
}

export type JobTarget = Record<string, unknown> & {
  // bulk_export fields (live in target_json)
  total?: number;
  packaged?: number;
  output_name?: string | null;
  downloaded?: boolean;
  expires_at?: string | null;
  // shared by bulk_export ({ work_id, reason }) and library_scan ({ path, reason })
  skipped?: (BulkExportSkip | LibraryScanSkip)[];
  // library_scan fields
  paths?: string[];
  ingested?: number;
};

export type Job = {
  id: number;
  type: string;
  status: "queued" | "running" | "paused" | "cancelling" | "completed" | "failed" | "cancelled";
  stage: string;
  progress: { current: number; total: number; percent: number };
  target: JobTarget;
  meta?: JobMeta | null;
  error?: string | null;
  retry_after?: number | null;
  created_at: string;
  updated_at: string;
};

export type MediaLibraryConfig = {
  recursive: boolean;
  watch: boolean;
  scan_interval_seconds: number;
  stable_seconds: number;
  io_timeout_seconds: number;
  include_hidden: boolean;
  follow_symlinks: boolean;
  exclude_patterns: string[];
  auto_scrape: boolean;
  auto_bind: boolean;
  language_mode: "any" | "strict" | "prefer";
  language: "chinese" | "japanese" | "english";
  cache_mode: "auto" | "always" | "off";
};

export type MediaLibrary = {
  id: number;
  name: string;
  root_path: string;
  kind: "managed" | "local" | "mounted";
  enabled: boolean;
  read_only: boolean;
  health: string;
  last_error: string | null;
  watch_error: string | null;
  last_scan_at: string | null;
  config: MediaLibraryConfig;
  work_count: number;
  item_count: number;
  error_count: number;
  pending_count: number;
  missing_count: number;
  removed_at: string | null;
  scrape_review_count: number;
  scanning: boolean;
  active_scan_job_id: number | null;
  active_scan_status: Job["status"] | null;
};

export type MediaLibraryInput = Pick<MediaLibrary, "name" | "root_path" | "kind" | "enabled" | "read_only" | "config">;

export type MigrationOptions = { work_ids: number[]; library_id: number; move: boolean; conflict: "rename" | "skip" };
export type MigrationCandidate = { id: number; title: string; pretty_title: string | null; page_count: number; size_bytes: number };
export type MigrationPreview = {
  library_id: number; library_name: string; root_path: string; move: boolean; total_bytes: number; free_bytes: number; ready: number; blocked: number;
  plan: { work_id: number; title: string; status: "ready" | "blocked" | "skipped"; reason?: string; name?: string; size_bytes?: number }[];
};

export type LibraryScanRun = {
  id: number;
  status: string;
  counts: Record<string, number>;
  errors: { path: string; reason: string }[];
  started_at: string;
  completed_at: string | null;
};

export type LibraryItem = {
  id: number;
  relative_path: string;
  work_id: number | null;
  status: string;
  size_bytes: number | null;
  last_error: string | null;
  title: string;
  metadata: Record<string, unknown>;
  indexed_at: string | null;
  missing_since: number | null;
};

export type ReadingCacheConfig = {
  max_bytes: number;
  ttl_hours: number;
  max_parallel: number;
  min_free_bytes: number;
};

export type ReadingCacheSummary = {
  config: ReadingCacheConfig;
  ready_bytes: number;
  reserved_bytes: number;
  ready_count: number;
  active_count: number;
  path: string;
};

export type CreatorSubscription = {
  id: number;
  remote_tag_id: number;
  tag_type: "artist" | "group";
  name: string;
  slug: string;
  enabled: boolean;
  email_enabled: boolean;
  interval_seconds: number;
  baseline_complete: boolean;
  status: "queued" | "checking" | "idle" | "error";
  scan_page: number;
  last_checked_at: string | null;
  last_error: string | null;
  next_check_at: number;
  seen_count?: number;
  unread_count?: number;
  recent_galleries: GallerySummary[];
};

export type SubscriptionUpdate = {
  id: number;
  subscription_id: number;
  name: string;
  slug: string;
  tag_type: "artist" | "group";
  remote_tag_id: number;
  gallery_id: number;
  gallery: GallerySummary;
  read_at: string | null;
  created_at: string;
};

export type SmtpSettings = {
  enabled: boolean;
  host: string;
  port: number;
  security: "starttls" | "ssl" | "none";
  username: string;
  password_configured: boolean;
  sender: string;
  recipient: string;
  site_url: string;
  timeout_seconds: number;
  last_test: { ok: boolean; message: string } | null;
};

export type MailOutbox = {
  result: {
    id: number; subscription_id: number | null; name: string | null; tag_type: string | null;
    status: "pending" | "sending" | "sent" | "failed" | "cancelled";
    attempts: number; last_error: string | null; created_at: string; sent_at: string | null;
  }[];
  counts: Partial<Record<"pending" | "sending" | "sent" | "failed" | "cancelled", number>>;
};

export const EXPORT_SYNC_THRESHOLD = 5;

export type JobLog = {
  id: number;
  job_id: number;
  level: "info" | "error" | string;
  message: string;
  created_at: string;
};

export type WorkbenchFailedJob = {
  id: number;
  type: string;
  target: Record<string, unknown>;
  error?: string | null;
  updated_at: string;
};

export type WorkbenchOverview = {
  library: {
    total: number;
    reading: number;
    completed: number;
    unread: number;
    untagged: number;
    total_pages: number;
    total_size_bytes: number;
  };
  governance: {
    total: number;
    unreviewed: number;
    stale: number;
    approved: number;
    automatic_issues: number;
    missing_metadata: number;
    untagged: number;
    dictionary_unmapped: number;
    dictionary_review: number;
    dictionary_conflict: number;
    missing_source: number;
    missing_comicinfo: number;
    missing_cover: number;
  };
  files: {
    work_count: number;
    source_bytes: number;
    cover_ok: number;
    missing_source: number;
    missing_cover: number;
    orphan_count: number;
    stale_count: number;
    reclaimable_bytes: number;
  };
  exports: { total: number; ready: number; blocked: number; warnings: number };
  jobs: {
    running: number;
    queued: number;
    paused: number;
    cancelling: number;
    failed: number;
    completed: number;
    cancelled: number;
    failed_recent: WorkbenchFailedJob[];
  };
  continue_reading: LibraryWork[];
  recent_added: LibraryWork[];
};

export type TranslationVerifyResult = {
  ok: boolean;
  provider: string;
  sample: string | null;
  status_code: number | null;
  message: string;
};

export type MachineTranslationSettings = {
  provider: "google_free" | "deepl";
  deepl_api_key_configured: boolean;
  deepl_key_source: "env" | "db" | "none";
  deepl_plan: "free" | "pro";
  target_lang: string;
  batch_limit: number;
  last_verify: TranslationVerifyResult | null;
};

export type NhentaiRuntimeStats = {
  cache_entries: number;
  cache_active_entries: number;
  cooldown_active: boolean;
  cooldown_remaining_seconds: number;
  cdn_configured: boolean;
};

export type AuthStatus = {
  configured: boolean;
  authenticated: boolean;
  session_days: number;
};

export type SettingsSummary = {
  nhentai: {
    base_url: string;
    user_agent: string;
    request_timeout: number;
    api_key_configured: boolean;
    api_key_source: "env" | "db" | "none";
    last_verify: null | {
      configured: boolean;
      ok: boolean;
      source: string;
      status_code: number | null;
      message: string;
    };
  };
  storage: Record<string, string>;
  privacy: {
    blur_covers_default: boolean;
  };
  reader: {
    default_mode: "single" | "scroll";
  };
  downloads: {
    default_library_id: number;
  };
  machine_translation: MachineTranslationSettings | null;
  export: {
    active_preset_id: string;
    presets: ExportPreset[];
    default_options: { write_comicinfo: boolean; keep_json: boolean; compress: boolean };
  };
};

export type ExportPreset = {
  id: string;
  name: string;
  naming_rule: string;
  comicinfo_rule: string;
  meta_rule: string;
  compression: string;
};

export type DiscoverSearchParams = {
  q?: string;
  page?: number;
  per_page?: number;
  sort?: string;
  language?: string;
  type?: string;
  tag_id?: number | null;
  tag_names?: string[];
  unimported_only?: boolean;
};

const JSON_HEADERS = { "Content-Type": "application/json" };
export const AUTH_REQUIRED_EVENT = "nh-archive-auth-required";
const DISCOVER_CACHE = new Map<string, { expiresAt: number; value: unknown; promise?: Promise<unknown> }>();
let completedImportJobs = "";

function clearDiscoverCache<T>(value: T): T {
  for (const url of DISCOVER_CACHE.keys()) {
    if (url.startsWith("/api/discover/") || url.startsWith("/api/dictionary/autocomplete")) {
      DISCOVER_CACHE.delete(url);
    }
  }
  return value;
}

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    if (response.status === 401 && url !== "/api/auth/login") {
      window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    }
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      message = payload.detail?.message || payload.detail || message;
    } catch {
      // Keep the HTTP status text.
    }
    throw new Error(String(message));
  }
  return response.json() as Promise<T>;
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      // fall through to the plain filename
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : fallback;
}

async function downloadFile(url: string, options: RequestInit, fallbackName: string): Promise<string> {
  const response = await fetch(url, options);
  if (!response.ok) {
    if (response.status === 401) window.dispatchEvent(new Event(AUTH_REQUIRED_EVENT));
    let message = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      message = payload.detail?.message || payload.detail || message;
    } catch {
      // Keep the HTTP status text.
    }
    throw new Error(String(message));
  }
  const blob = await response.blob();
  const filename = filenameFromDisposition(response.headers.get("Content-Disposition"), fallbackName);
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
  return filename;
}

async function cachedDiscoverRequest<T>(url: string, ttlMs = 60_000): Promise<T> {
  const now = Date.now();
  const cached = DISCOVER_CACHE.get(url);
  if (cached?.promise) return cached.promise as Promise<T>;
  if (cached && cached.expiresAt > now) return cached.value as T;
  const promise = request<T>(url)
    .then((value) => {
      if (DISCOVER_CACHE.get(url)?.promise === promise) DISCOVER_CACHE.set(url, { expiresAt: Date.now() + ttlMs, value });
      return value;
    })
    .catch((error) => {
      if (DISCOVER_CACHE.get(url)?.promise === promise) DISCOVER_CACHE.delete(url);
      throw error;
    });
  DISCOVER_CACHE.set(url, { expiresAt: now + ttlMs, value: cached?.value, promise });
  return promise;
}

function subscriptionsChanged<T>(value: T): T {
  for (const key of DISCOVER_CACHE.keys()) if (key.startsWith("/api/subscriptions")) DISCOVER_CACHE.delete(key);
  window.dispatchEvent(new Event("nh-subscriptions-changed"));
  return value;
}

async function jobsWithCacheCoherence(): Promise<{ result: Job[] }> {
  const payload = await cachedDiscoverRequest<{ result: Job[] }>("/api/jobs", 0);
  const signature = payload.result
    .filter(
      (job) =>
        job.status === "completed" &&
        (job.type === "remote_import" || job.type === "library_scan"),
    )
    .map((job) => job.id)
    .sort((left, right) => left - right)
    .join(",");
  if (signature !== completedImportJobs) {
    completedImportJobs = signature;
    clearDiscoverCache(undefined);
  }
  return payload;
}

export const api = {
  authStatus: () => request<AuthStatus>("/api/auth/status"),
  authSetup: (password: string) => request<AuthStatus>("/api/auth/setup", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ password }),
  }),
  authLogin: (password: string) => request<AuthStatus>("/api/auth/login", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ password }),
  }),
  authChangePassword: (currentPassword: string, newPassword: string) => request<AuthStatus>("/api/auth/change", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  }),
  authLogout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST", headers: JSON_HEADERS }),
  latest: (page = 1, perPage = 24) =>
    cachedDiscoverRequest<{ result: GallerySummary[]; total: number; num_pages?: number; per_page?: number }>(
      `/api/discover/latest?page=${page}&per_page=${perPage}`
    ),
  feed: (params: DiscoverSearchParams) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 24));
    query.set("sort", params.sort ?? "date");
    query.set("language", params.language ?? "all");
    query.set("type", params.type ?? "all");
    if (params.tag_id) query.set("tag_id", String(params.tag_id));
    if (params.tag_names?.length) query.set("tag_names", params.tag_names.join(","));
    query.set("unimported_only", String(Boolean(params.unimported_only)));
    return cachedDiscoverRequest<{
      result: GallerySummary[];
      total: number | null;
      num_pages: number;
      per_page: number;
      reason?: string;
      query?: string;
      source?: string;
    }>(`/api/discover/feed?${query.toString()}`);
  },
  popular: () => cachedDiscoverRequest<{ result: GallerySummary[]; total: number }>("/api/discover/popular", 5 * 60_000),
  random: () => request<GalleryDetail>("/api/discover/random"),
  tagged: (tagId: number, page = 1, perPage = 24, sort = "date") =>
    cachedDiscoverRequest<{ result: GallerySummary[]; total: number; num_pages: number; per_page: number; source?: string }>(
      `/api/discover/tagged?tag_id=${tagId}&page=${page}&per_page=${perPage}&sort=${encodeURIComponent(sort)}`
    ),
  search: (params: DiscoverSearchParams) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 24));
    query.set("sort", params.sort ?? "date");
    query.set("language", params.language ?? "all");
    query.set("type", params.type ?? "all");
    query.set("unimported_only", String(Boolean(params.unimported_only)));
    return cachedDiscoverRequest<{ result: GallerySummary[]; total: number; num_pages: number; per_page: number; reason?: string; query?: string }>(
      `/api/discover/search?${query.toString()}`
    );
  },
  gallery: (id: number) => cachedDiscoverRequest<GalleryDetail>(`/api/discover/galleries/${id}`, 10 * 60_000),
  tagAutocomplete: (q: string, limit = 12) =>
    cachedDiscoverRequest<{ result: RemoteTag[] }>(`/api/discover/tags/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`, 5 * 60_000),
  cachedTags: (limit = 60) => cachedDiscoverRequest<{ result: RemoteTag[] }>(`/api/discover/tags/cached?limit=${limit}`, 5 * 60_000),
  dictionarySummary: () => request<DictionarySummary>("/api/dictionary/summary"),
  dictionaryCandidates: (params: { q?: string; type?: string; status?: string; limit?: number; offset?: number } = {}) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("type", params.type ?? "all");
    query.set("status", params.status ?? "all");
    query.set("limit", String(params.limit ?? 50));
    query.set("offset", String(params.offset ?? 0));
    return request<{ result: DictionaryCandidate[] }>(`/api/dictionary/candidates?${query.toString()}`);
  },
  dictionaryEvidence: (params: { remote_tag_id?: number | null; dictionary_id?: number | null }) => {
    const query = new URLSearchParams();
    if (params.remote_tag_id) query.set("remote_tag_id", String(params.remote_tag_id));
    if (params.dictionary_id) query.set("dictionary_id", String(params.dictionary_id));
    return request<DictionaryEvidence>(`/api/dictionary/evidence?${query.toString()}`);
  },
  dictionaryAutocomplete: (q: string, limit = 20) =>
    cachedDiscoverRequest<{ result: RemoteTag[] }>(`/api/dictionary/autocomplete?q=${encodeURIComponent(q)}&limit=${limit}`, 5 * 60_000),
  dictionaryPreviewApply: (payload: DictionaryApplyPayload) =>
    request<DictionaryPreview>("/api/dictionary/preview-apply", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }),
  dictionaryApply: (payload: DictionaryApplyPayload) =>
    request<DictionaryApplyResult>("/api/dictionary/apply", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }).then(clearDiscoverCache),
  dictionaryTranslate: (text: string) =>
    request<{ text: string; translation: string; provider: string }>("/api/dictionary/translate", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ text })
    }),
  dictionarySuggestBatch: (limit = 20, remoteTagIds?: number[]) =>
    request<{ generated: number; items: Array<{ original_text: string; zh_name: string; tag_type: string; remote_tag_id: number }> }>(
      "/api/dictionary/suggest-batch",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ limit, remote_tag_ids: remoteTagIds }) }
    ),
  dictionaryPreviewBulkImport: (rows: BulkImportRow[]) =>
    request<BulkImportPreview>("/api/dictionary/preview-bulk-import", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ rows })
    }),
  dictionaryBulkImport: (rows: BulkImportRow[]) =>
    request<BulkImportPreview>("/api/dictionary/bulk-import", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ rows })
    }).then(clearDiscoverCache),
  dictionaryIgnore: (id: number) => request<DictionaryStatusResult>(`/api/dictionary/${id}/ignore`, { method: "POST", headers: JSON_HEADERS }).then(clearDiscoverCache),
  dictionaryReview: (id: number) => request<DictionaryStatusResult>(`/api/dictionary/${id}/review`, { method: "POST", headers: JSON_HEADERS }),
  dictionaryDelete: (id: number) => request<DictionaryDeleteResult>(`/api/dictionary/${id}`, { method: "DELETE", headers: JSON_HEADERS }).then(clearDiscoverCache),
  importGallery: (id: number) =>
    request<Job>(`/api/discover/galleries/${id}/import`, { method: "POST", headers: JSON_HEADERS }),
  workbenchOverview: () => request<WorkbenchOverview>("/api/workbench/overview"),
  librarySummary: () => request<LibrarySummary>("/api/library/summary"),
  libraryRevision: () => request<{ revision: number }>("/api/library/revision"),
  librarySearch: (params: LibrarySearchParams = {}) => {
    const query = new URLSearchParams();
    query.set("q", params.q ?? "");
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 24));
    query.set("sort", params.sort ?? "recent_updated");
    query.set("read_status", params.read_status ?? "all");
    query.set("source", params.source ?? "all");
    if (params.library_id) query.set("library_id", String(params.library_id));
    query.set("language", params.language ?? "all");
    if (params.tag_ids?.length) query.set("tag_ids", params.tag_ids.join(","));
    params.tag_keys?.forEach(key => query.append("tag_keys", key));
    query.set("favorite_only", String(Boolean(params.favorite_only)));
    return request<LibrarySearchResult>(`/api/library/search?${query.toString()}`);
  },
  libraryRecentAdded: (limit = 12) => request<{ result: LibraryWork[] }>(`/api/library/recent-added?limit=${limit}`),
  libraryRecentRead: (limit = 12) => request<{ result: LibraryWork[] }>(`/api/library/recent-read?limit=${limit}`),
  libraryReadingHistory: (page = 1, per_page = 30) =>
    request<ReadingHistoryPage>(`/api/library/reading-history?page=${page}&per_page=${per_page}&timezone_offset_minutes=${-new Date().getTimezoneOffset()}`),
  libraryStatistics: (days = 30) => {
    const timezoneOffset = -new Date().getTimezoneOffset();
    return request<ReadingStatistics>(`/api/library/statistics?days=${days}&timezone_offset_minutes=${timezoneOffset}`);
  },
  libraryContinueReading: (limit = 12) => request<{ result: LibraryWork[] }>(`/api/library/continue-reading?limit=${limit}`),
  libraryTagFilters: (q = "", limit = 40) =>
    request<{ result: LibraryTagFilter[] }>(`/api/library/tag-filters?q=${encodeURIComponent(q)}&limit=${limit}`),
  governanceQueue: () => request<GovernanceQueue>("/api/governance/queue"),
  workGovernance: (id: number) => request<GovernanceAggregate>(`/api/works/${id}/governance`),
  applyWorkGovernance: (id: number, payload: GovernanceApplyPayload) =>
    request<GovernanceApplyResult>(`/api/works/${id}/governance/apply`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }).then(clearDiscoverCache),
  translateWorkGovernance: (id: number, fields?: string[]) =>
    request<GovernanceTranslateResult>(`/api/works/${id}/governance/translate`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ fields: fields ?? null })
    }),
  reviewWorkGovernance: (id: number, action: "approve" | "reopen", note?: string) =>
    request<GovernanceReviewResult>(`/api/works/${id}/governance/review`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ action, note: note?.trim() || null })
    }),
  governanceBulkPreview: (work_ids: number[], actions: GovernanceBulkActions) =>
    request<GovernanceBulkPreview>("/api/governance/bulk/preview", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_ids, actions })
    }),
  governanceBulkApply: (work_ids: number[], actions: GovernanceBulkActions) =>
    request<GovernanceBulkResult>("/api/governance/bulk/apply", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_ids, actions })
    }).then(clearDiscoverCache),
  metadataRefreshPreview: (work_ids: number[], gallery_ids: Record<number, number> = {}, queries: Record<number, string> = {}) =>
    request<MetadataRefreshPreview>("/api/governance/metadata-refresh/preview", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ work_ids, gallery_ids, queries })
    }),
  metadataRefreshApply: (matches: Array<{ work_id: number; version?: string; query?: string; bind?: boolean } & MetadataRefreshMatch>) =>
    request<MetadataRefreshResult>("/api/governance/metadata-refresh/apply", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({
        matches: matches.map(({ work_id, gallery_id, source, version, query, bind }) => ({
          work_id,
          gallery_id,
          source, version, query, bind
        }))
      })
    }).then(clearDiscoverCache),
  exportQueue: (ids?: number[]) => request<ExportQueue>("/api/exports/queue" + (ids?.length ? "?work_ids=" + ids.join(",") : "")),
  exportSummary: () => request<ExportSummaryStats>("/api/exports/summary"),
  exportPreview: (id: number, options?: ExportRequestOptions) =>
    options
      ? request<ExportPreview>(`/api/works/${id}/export-preview`, {
          method: "POST",
          headers: JSON_HEADERS,
          body: JSON.stringify(options)
        })
      : request<ExportPreview>(`/api/works/${id}/export-preview`),
  downloadExport: (id: number, options?: ExportRequestOptions) => {
    const query = new URLSearchParams();
    if (options?.output_name) query.set("output_name", options.output_name);
    if (options?.write_comicinfo !== undefined) query.set("write_comicinfo", String(options.write_comicinfo));
    if (options?.keep_json !== undefined) query.set("keep_json", String(options.keep_json));
    if (options?.compress !== undefined) query.set("compress", String(options.compress));
    const qs = query.toString();
    return downloadFile(`/api/works/${id}/export/download${qs ? `?${qs}` : ""}`, {}, `work-${id}.cbz`);
  },
  downloadExportBundle: (items: ExportBatchItem[], options?: Omit<ExportRequestOptions, "output_name">) =>
    downloadFile(
      "/api/exports/download",
      { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ items, ...options }) },
      "导出合集.zip"
    ),
  enqueueBulkExport: (items: ExportBatchItem[], options?: Omit<ExportRequestOptions, "output_name">) =>
    request<Job>("/api/exports/bulk-jobs", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ items, options: options ?? {} }),
    }),
  bulkExportDownloadUrl: (jobId: number) => `/api/jobs/${jobId}/export/download`,
  filesOverview: () => request<FileOverview>("/api/files/overview"),
  filesInventory: (params: FileInventoryParams = {}) => {
    const query = new URLSearchParams();
    query.set("category", params.category ?? "all");
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    if (params.sort && params.sort !== "default") query.set("sort", params.sort);
    query.set("page", String(params.page ?? 1));
    query.set("per_page", String(params.per_page ?? 50));
    return request<FileInventory>(`/api/files/inventory?${query.toString()}`);
  },
  previewFileDelete: (targets: FileDeleteTarget[]) =>
    request<FileDeletePreview>("/api/files/preview-delete", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ targets }),
    }),
  deleteFiles: (targets: FileDeleteTarget[]) =>
    request<FileDeleteResult>("/api/files/delete", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ targets }),
    }).then(clearDiscoverCache),
  filesDuplicates: () => request<FileDuplicates>("/api/files/duplicates"),
  works: () => request<{ result: Work[] }>("/api/works"),
  work: (id: number) => request<LibraryWork>(`/api/works/${id}`),
  pages: (id: number) => request<{ result: PageInfo[] }>(`/api/works/${id}/pages`),
  prepareReadingSource: (id: number) => request<ReadingSource>(`/api/works/${id}/reading-source`, { method: "POST" }),
  readerBridge: (id: number, fresh = false) => request<ReaderBridgeStatus>(`/api/works/${id}/bridge?fresh=${fresh}`),
  verifyReaderBridge: (id: number) => request<Job>(`/api/works/${id}/bridge/verify`, { method: "POST" }),
  enableReaderBridge: (id: number, enabled: boolean) => request<ReaderBridgeStatus>(`/api/works/${id}/bridge?enabled=${enabled}`, { method: "PATCH" }),
  releaseReadingSource: (id: number, lease: string) => request<{ released: boolean }>(`/api/works/${id}/reading-source/${lease}`, { method: "DELETE", keepalive: true }),
  readerState: (id: number) => request<ReaderState>(`/api/works/${id}/reader-state`),
  setWorkFavorite: (id: number, favorite: boolean) =>
    request<LibraryWork>(`/api/works/${id}/favorite`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ favorite }),
    }),
  startReadingSession: (id: number, sessionKey: string, pageIndex: number, cacheLease: string | null = null, sourceRevision: string | null = null) =>
    request<ReadingSession>(`/api/works/${id}/reading-sessions`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ session_key: sessionKey, page_index: pageIndex, cache_lease: cacheLease, source_revision: sourceRevision }),
    }),
  updateReadingSession: (id: number, sessionId: number, durationSeconds: number, pageIndex: number, finished = false, keepalive = false, cacheLease?: string | null) =>
    request<ReadingSession>(`/api/works/${id}/reading-sessions/${sessionId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ duration_seconds: durationSeconds, page_index: pageIndex, finished, cache_lease: cacheLease }),
      keepalive,
    }),
  startRemoteReadingSession: (galleryId: number, sessionKey: string, pageIndex: number) =>
    request<ReadingSession>(`/api/discover/galleries/${galleryId}/reading-sessions`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ session_key: sessionKey, page_index: pageIndex }),
    }),
  updateRemoteReadingSession: (galleryId: number, sessionId: number, durationSeconds: number, pageIndex: number, finished = false, keepalive = false) =>
    request<ReadingSession>(`/api/discover/galleries/${galleryId}/reading-sessions/${sessionId}`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ duration_seconds: durationSeconds, page_index: pageIndex, finished }),
      keepalive,
    }),
  updateReaderState: (id: number, pageIndex: number, completed = false, cacheLease: string | null = null, keepalive = false, sourceRevision: string | null = null) =>
    request<ReaderState>(`/api/works/${id}/reader-state`, {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ page_index: pageIndex, completed, cache_lease: cacheLease, source_revision: sourceRevision }),
      keepalive,
    }).then(value => { window.dispatchEvent(new Event("nh-reader-state-changed")); return value; }),
  jobs: jobsWithCacheCoherence,
  jobLogs: (id: number) => request<{ result: JobLog[] }>(`/api/jobs/${id}/logs`),
  pauseJob: (id: number) => request<Job>(`/api/jobs/${id}/pause`, { method: "POST", headers: JSON_HEADERS }),
  resumeJob: (id: number) => request<Job>(`/api/jobs/${id}/resume`, { method: "POST", headers: JSON_HEADERS }),
  cancelJob: (id: number) => request<Job>(`/api/jobs/${id}/cancel`, { method: "POST", headers: JSON_HEADERS }),
  retryJob: (id: number) => request<Job>(`/api/jobs/${id}/retry`, { method: "POST", headers: JSON_HEADERS }),
  deleteJob: (id: number) => request<{ deleted: number }>(`/api/jobs/${id}`, { method: "DELETE" }),
  clearJobs: () => request<{ deleted: number }>("/api/jobs/clear", { method: "POST", headers: JSON_HEADERS }),
  settings: () => request<SettingsSummary>("/api/settings"),
  creatorSubscriptions: () => request<{ result: CreatorSubscription[] }>("/api/subscriptions"),
  subscribeCreator: (remote_tag_id: number, tag_type: "artist" | "group") => request<CreatorSubscription>("/api/subscriptions", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ remote_tag_id, tag_type }),
  }).then(subscriptionsChanged),
  updateSubscription: (id: number, payload: Partial<Pick<CreatorSubscription, "enabled" | "email_enabled" | "interval_seconds">>) => request<CreatorSubscription>(`/api/subscriptions/${id}`, {
    method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(payload),
  }).then(subscriptionsChanged),
  unsubscribeCreator: (id: number) => request<{ removed: number }>(`/api/subscriptions/${id}`, { method: "DELETE" }).then(subscriptionsChanged),
  checkSubscription: (id: number) => request<CreatorSubscription>(`/api/subscriptions/${id}/check`, { method: "POST", headers: JSON_HEADERS }).then(subscriptionsChanged),
  subscriptionUpdates: (page = 1, unread_only = false) => cachedDiscoverRequest<{ result: SubscriptionUpdate[]; total: number; unread_count: number; page: number; per_page: number }>(`/api/subscriptions/updates?page=${page}&unread_only=${unread_only}`, 500),
  readSubscriptionUpdates: (update_id?: number) => request<{ ok: boolean }>("/api/subscriptions/updates/read", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ update_id: update_id ?? null }),
  }).then(subscriptionsChanged),
  smtpSettings: () => request<SmtpSettings>("/api/settings/smtp"),
  configureSmtp: (payload: Partial<Omit<SmtpSettings, "password_configured" | "last_test">> & { password?: string; clear_password?: boolean }) => request<SmtpSettings>("/api/settings/smtp", {
    method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(payload),
  }),
  testSmtp: () => request<{ ok: boolean; message: string }>("/api/settings/smtp/test", { method: "POST", headers: JSON_HEADERS }),
  mailOutbox: () => request<MailOutbox>("/api/settings/smtp/outbox"),
  retryMail: (id: number) => request<{ queued: number }>(`/api/settings/smtp/outbox/${id}/retry`, { method: "POST", headers: JSON_HEADERS }),
  updateSettings: (payload: Record<string, unknown>) =>
    request<SettingsSummary>("/api/settings", {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify(payload)
    }),
  verifyNhentaiSettings: () =>
    request<{ configured: boolean; ok: boolean; source: string; status_code: number | null; message: string }>(
      "/api/settings/nhentai/verify",
      { method: "POST", headers: JSON_HEADERS }
    ),
  verifyTranslationSettings: () =>
    request<TranslationVerifyResult>("/api/settings/translation/verify", { method: "POST", headers: JSON_HEADERS }),
  clearNhentaiCache: () =>
    request<{ ok: boolean; message: string }>("/api/settings/nhentai/clear-cache", { method: "POST", headers: JSON_HEADERS }).then(clearDiscoverCache),
  nhentaiRuntime: () => request<NhentaiRuntimeStats>("/api/settings/nhentai/runtime"),
  scanLibraryPreview: () =>
    request<LibraryScanPreview>("/api/library/scan/preview", { method: "POST", headers: JSON_HEADERS }),
  mediaLibraries: (includeRemoved = false) => request<{ result: MediaLibrary[]; defaults: MediaLibraryConfig; default_download_library_id: number }>("/api/library/directories" + (includeRemoved ? "?include_removed=true" : "")),
  migrationCandidates: (page = 1, q = "") => request<{ result: MigrationCandidate[]; total: number; page: number; per_page: number }>(`/api/library/migration/candidates?page=${page}&q=${encodeURIComponent(q)}`),
  migrationPreview: (options: MigrationOptions) => request<MigrationPreview>("/api/library/migration/preview", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(options) }),
  migrateLibrary: (options: MigrationOptions) => request<Job>("/api/library/migration", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(options) }),
  previewMail: () => request<{ html: string; work_id: number }>("/api/settings/smtp/preview"),
  browseDirectories: (path: string) => request<{ path: string; parent: string; result: { name: string; path: string }[]; truncated: boolean }>("/api/library/browse?path=" + encodeURIComponent(path)),
  addMediaLibrary: (payload: MediaLibraryInput) => request<MediaLibraryInput & { id: number }>("/api/library/directories", {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(payload),
  }),
  updateMediaLibrary: (id: number, payload: Partial<MediaLibraryInput>) => request<MediaLibraryInput & { id: number }>(`/api/library/directories/${id}`, {
    method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(payload),
  }),
  removeMediaLibrary: (id: number, purge = false) => request<{ removed: number; source_files_deleted: boolean; metadata_preserved: boolean; removed_works: number }>(`/api/library/directories/${id}?purge=${purge}`, { method: "DELETE" }),
  mediaLibraryRemovalPreview: (id: number) => request<{ exclusive_works: number; shared_works: number; purge_allowed: boolean; warnings: string[] }>(`/api/library/directories/${id}/remove-preview`),
  libraryScanRuns: (id: number, limit = 5) => request<{ result: LibraryScanRun[] }>(`/api/library/directories/${id}/runs?limit=${limit}`),
  libraryItems: (id: number, status = "error", page = 1) => request<{ result: LibraryItem[]; total: number; page: number; per_page: number }>(`/api/library/directories/${id}/items?status=${encodeURIComponent(status)}&page=${page}&per_page=20`),
  forgetLibraryItem: (libraryId: number, itemId: number) => request<{ removed: number; source_file_deleted: boolean; work_id: number | null; work_metadata_preserved: boolean }>(`/api/library/directories/${libraryId}/items/${itemId}`, { method: "DELETE" }),
  readingCache: () => request<ReadingCacheSummary>("/api/library/cache"),
  configureReadingCache: (payload: ReadingCacheConfig) => request<ReadingCacheSummary>("/api/library/cache", {
    method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify(payload),
  }),
  clearReadingCache: () => request<{ deleted: number; freed_bytes: number }>("/api/library/cache/clear", { method: "POST", headers: JSON_HEADERS }),
  enqueueLibraryScan: (paths?: string[], libraryId?: number) =>
    request<Job>("/api/library/scan", {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ paths: paths ?? null, library_id: libraryId ?? null }),
    }),
};
