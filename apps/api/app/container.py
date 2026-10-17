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
from app.services.local_metadata_service import LocalMetadataService
from app.services.governance_service import GovernanceService
from app.services.import_service import ImportService
from app.services.upload_service import UploadService
from app.services.job_service import JobService
from app.services.library_scan_job_service import LibraryScanJobService
from app.services.library_scan_service import LibraryScanService
from app.services.library_index_service import LibraryIndexService
from app.services.library_monitor_service import LibraryMonitorService
from app.services.library_service import LibraryService
from app.services.library_migration_service import LibraryMigrationService
from app.services.metadata_refresh_service import MetadataRefreshService
from app.services.nhentai_client import NhentaiClient
from app.services.notification_service import NotificationService
from app.services.reader_service import ReaderService
from app.services.reader_bridge_service import ReaderBridgeService
from app.services.settings_service import SettingsService
from app.services.subscription_service import SubscriptionService
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
    media_libraries = archive.libraries
    library_index = LibraryIndexService(settings, db, media_libraries)
    discover = DiscoverService(db, client)
    notifications = NotificationService(db, settings, client)
    subscriptions = SubscriptionService(db, client, discover, notifications)
    reader = ReaderService(db, archive.cache)
    library = LibraryService(db)
    translation = TranslationService(db)
    dictionary = DictionaryService(db, client, translation)
    metadata_refresh = MetadataRefreshService(db, client, discover, dictionary, media_libraries)
    governance = GovernanceService(db, dictionary, settings, archive.cache)
    exports = ExportService(db, settings, archive.cache)
    files = FileMaintenanceService(db, settings, archive.cache)
    imports = ImportService(settings, client, jobs, archive, discover, dictionary)
    export_jobs = ExportJobService(settings, jobs, exports)
    library_scan = LibraryScanService(settings, db)
    library_scan_jobs = LibraryScanJobService(settings, jobs, library_index, media_libraries)
    library_scan_jobs.migration = LibraryMigrationService(settings, db, media_libraries, library_index, files, jobs)
    library_scan_jobs.bridge = ReaderBridgeService(db, archive, client, jobs)

    return SimpleNamespace(
        settings=settings,
        db=db,
        auth=AuthService(db),
        client=client,
        jobs=jobs,
        archive=archive,
        discover=discover,
        notifications=notifications,
        subscriptions=subscriptions,
        reader=reader,
        reader_bridge=library_scan_jobs.bridge,
        library=library,
        translation=translation,
        dictionary=dictionary,
        metadata_refresh=metadata_refresh,
        governance=governance,
        exports=exports,
        files=files,
        local_metadata=LocalMetadataService(files, media_libraries),
        imports=imports,
        uploads=UploadService(archive),
        export_jobs=export_jobs,
        library_scan=library_scan,
        library_scan_jobs=library_scan_jobs,
        media_libraries=media_libraries,
        library_index=library_index,
        library_monitor=LibraryMonitorService(library_index, media_libraries),
        settings_service=SettingsService(db, settings, client, translation, media_libraries),
        workbench=WorkbenchService(library, governance, jobs, files, exports),
    )


services = build_services()
