"""Button edge detection across consecutive samples."""

from dataclasses import dataclass


@dataclass(slots=True)
class InputFrame:
    """The last two button samples, so a press can be told apart from a hold."""

    buttons: int = 0
    prev: int = 0

    def update(self, buttons: int) -> None:
        """Record this sample's button bits."""
        self.prev = self.buttons
        self.buttons = buttons

    def pressed(self, button: int) -> bool:
        """Whether ``button`` went down since the previous sample."""
        return bool(self.buttons & ~self.prev & button)

    def settle(self) -> None:
        """Treat the current bits as already seen, so a held button is not a fresh edge."""
        self.prev = self.buttons
