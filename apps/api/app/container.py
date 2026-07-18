from types import SimpleNamespace

from app.config import load_settings
from app.database import Database
from app.services.archive_service import ArchiveService
from app.services.auth_service import AuthService
from app.services.dictionary_service import DictionaryService
from app.services.discover_service import DiscoverService
from app.services.export_job_service import ExportJobService
from app.services.export_service import ExportService
from app.services.file_service import FileMaintenanceService
from app.services.governance_service import GovernanceService
from app.services.import_service import ImportService
from app.services.job_service import JobService
from app.services.library_scan_job_service import LibraryScanJobService
from app.services.library_scan_service import LibraryScanService
from app.services.library_service import LibraryService
from app.services.metadata_refresh_service import MetadataRefreshService
from app.services.nhentai_client import NhentaiClient
from app.services.reader_service import ReaderService
from app.services.settings_service import SettingsService
from app.services.translation_service import TranslationService
from app.services.workbench_service import WorkbenchService


def build_services() -> SimpleNamespace:
    settings = load_settings()
    db = Database(settings.database_path)
    db.init_schema()
    db.rebase_managed_paths(settings.data_dir)
    client = NhentaiClient(
        base_url=settings.nhentai_base_url,
        user_agent=settings.user_agent,
        api_key=settings.nhentai_api_key,
        timeout=settings.request_timeout,
    )
    jobs = JobService(db)
    archive = ArchiveService(db, settings)
    discover = DiscoverService(db, client)
    reader = ReaderService(db)
    library = LibraryService(db)
    translation = TranslationService(db)
    dictionary = DictionaryService(db, client, translation)
    metadata_refresh = MetadataRefreshService(db, client, discover, dictionary)
    governance = GovernanceService(db, dictionary, settings)
    exports = ExportService(db, settings)
    files = FileMaintenanceService(db, settings)
    imports = ImportService(settings, client, jobs, archive, discover, dictionary)
    export_jobs = ExportJobService(settings, jobs, exports)
    library_scan = LibraryScanService(settings, db)
    library_scan_jobs = LibraryScanJobService(settings, jobs, archive, library_scan)

    return SimpleNamespace(
        settings=settings,
        db=db,
        auth=AuthService(db),
        client=client,
        jobs=jobs,
        archive=archive,
        discover=discover,
        reader=reader,
        library=library,
        translation=translation,
        dictionary=dictionary,
        metadata_refresh=metadata_refresh,
        governance=governance,
        exports=exports,
        files=files,
        imports=imports,
        export_jobs=export_jobs,
        library_scan=library_scan,
        library_scan_jobs=library_scan_jobs,
        settings_service=SettingsService(db, settings, client, translation),
        workbench=WorkbenchService(library, governance, jobs, files, exports),
    )


services = build_services()
