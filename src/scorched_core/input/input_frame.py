"""Button edge detection across consecutive samples."""

from dataclasses import dataclass


@dataclass(slots=True)
class InputFrame:
    """Skeleton: remembers nothing, so no edge is ever seen."""

    buttons: int = 0
    prev: int = 0

    def update(self, buttons: int) -> None:
        """Record this sample's button bits."""
        self.buttons = buttons

    def pressed(self, button: int) -> bool:  # noqa: ARG002 - skeleton
        """Whether ``button`` went down since the previous sample."""
        return False

    def settle(self) -> None:
        """Treat the current bits as already seen."""
