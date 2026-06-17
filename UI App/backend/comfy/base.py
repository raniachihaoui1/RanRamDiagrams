"""ComfyUI client abstraction.

The rest of the app depends only on this interface, so swapping the mock for a
real ComfyUI instance (COMFY_MODE=real) requires no changes upstream.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

# async callback(progress 0..1, status_label)
ProgressCallback = Callable[[float, str], Awaitable[None]]
# sync callback(meta) — lets a client report run metadata (e.g. ComfyUI's
# prompt_id) back to the caller so a cancel request can target it.
MetaCallback = Callable[[dict[str, Any]], None]


@dataclass
class GenParams:
    mode: str = "txt2img"  # txt2img | img2img
    prompt: str = ""
    negative: str = ""
    model: str | None = None
    loras: list[str] = field(default_factory=list)
    width: int = 1024
    height: int = 1024
    count: int = 1
    seed: int | None = None
    reference_image_path: str | None = None
    reference_image_id: str | None = None
    reference_weight: float = 0.5


class ComfyClient(ABC):
    """A backend that turns GenParams into one or more PNG images."""

    name: str = "base"

    @abstractmethod
    async def generate(
        self,
        params: GenParams,
        on_progress: ProgressCallback,
        on_meta: MetaCallback | None = None,
    ) -> list[bytes]:
        """Run generation, reporting progress, and return PNG bytes per image.

        `on_meta` (if given) is called with run metadata as it becomes known
        (e.g. `{"prompt_id": ...}`), so the caller can later cancel the run.
        """
        raise NotImplementedError

    async def cancel(self, meta: dict[str, Any]) -> None:
        """Best-effort cancellation of an in-flight run, given the metadata
        previously reported via `on_meta`. Default: nothing to do (the asyncio
        task cancellation alone stops a local/mock run)."""
        return None
