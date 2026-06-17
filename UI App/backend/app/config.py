"""Application configuration, loaded from environment / .env.

All paths default to locations inside the `UI App/` directory so the app is
plug-and-ready: generated images land in storage/, workflows live in workflows/.
Models are NOT hosted here — in real mode they come from ComfyUI.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app/config.py -> UI App/
APP_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(APP_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Branding
    app_name: str = "RanRam Studio"

    # ComfyUI integration
    comfy_mode: str = "auto"  # "auto" | "mock" | "real"
    comfy_url: str = "http://127.0.0.1:8188"
    comfy_dir: str = "C:/Users/Win11/ComfyUI"

    # Server
    host: str = "127.0.0.1"
    port: int = 8000
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    # Storage / workflows (relative to APP_ROOT unless absolute)
    storage_dir: str = "storage"
    workflows_dir: str = "workflows"

    # Local LoRA folder to scan for the dropdown — typically ComfyUI's
    # models/loras folder (e.g. E:/ComfyUI/models/loras). Empty = don't scan
    # (real mode then lists LoRAs from ComfyUI's API only). Scanned entries are
    # merged with the ComfyUI list in real mode and used directly in mock mode.
    loras_dir: str = ""

    # Generation limits
    max_images_per_request: int = 4

    def _resolve(self, value: str) -> Path:
        p = Path(value)
        return p if p.is_absolute() else (APP_ROOT / p)

    @property
    def storage_path(self) -> Path:
        return self._resolve(self.storage_dir)

    @property
    def workflows_path(self) -> Path:
        return self._resolve(self.workflows_dir)

    @property
    def loras_path(self) -> Path | None:
        if self.loras_dir.strip():
            return self._resolve(self.loras_dir)
        # Auto-derive from comfy_dir when LORAS_DIR is not set
        p = Path(self.comfy_dir) / "models" / "loras"
        return p if p.exists() else None

    @property
    def images_path(self) -> Path:
        return self.storage_path / "images"

    @property
    def thumbnails_path(self) -> Path:
        return self.storage_path / "thumbnails"

    @property
    def uploads_path(self) -> Path:
        return self.storage_path / "uploads"

    @property
    def canvas_projects_path(self) -> Path:
        return self.storage_path / "canvas_projects"

    @property
    def training_datasets_path(self) -> Path:
        return self.storage_path / "training_datasets"

    @property
    def db_path(self) -> Path:
        return self.storage_path / "app.db"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    def ensure_dirs(self) -> None:
        # Note: models_path is intentionally NOT created — in real mode models
        # live in ComfyUI, and in mock mode none are read. See services/catalog.
        for p in (
            self.images_path,
            self.thumbnails_path,
            self.uploads_path,
            self.canvas_projects_path,
            self.workflows_path,
            self.training_datasets_path,
        ):
            p.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    return Settings()
