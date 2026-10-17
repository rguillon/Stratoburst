from array import array

import pytest

from scorched_web.bridge.render_sink import RenderSink


class FakeTypedArray:
    """Mirrors the JsProxy typed-array surface the sink uses."""

    def __init__(self, length: int) -> None:
        self.length = length
        self.got: array | None = None
        self.assigns = 0

    def assign(self, data: array) -> None:
        if len(data) != self.length:
            msg = "cannot assign to TypedArray of length ..."
            raise ValueError(msg)
        self.got = data
        self.assigns += 1


@pytest.fixture
def buffers() -> dict[str, array]:
    return {"header": array("f", [0.0] * 4), "pbullets": array("f", [0.0] * 8)}


def test_attach_matching_length(buffers: dict[str, array]) -> None:
    sink = RenderSink(buffers)
    sink.attach("header", FakeTypedArray(4))


def test_attach_length_mismatch_names_channel(buffers: dict[str, array]) -> None:
    sink = RenderSink(buffers)
    with pytest.raises(ValueError, match="pbullets"):
        sink.attach("pbullets", FakeTypedArray(7))


def test_attach_unknown_channel(buffers: dict[str, array]) -> None:
    sink = RenderSink(buffers)
    with pytest.raises(ValueError, match="nope"):
        sink.attach("nope", FakeTypedArray(4))


def test_flush_without_bulk_touches_only_header(buffers: dict[str, array]) -> None:
    sink = RenderSink(buffers)
    header, pbullets = FakeTypedArray(4), FakeTypedArray(8)
    sink.attach("header", header)
    sink.attach("pbullets", pbullets)
    sink.flush(bulk=False)
    assert header.got is buffers["header"]
    assert pbullets.assigns == 0


def test_flush_with_bulk_touches_all(buffers: dict[str, array]) -> None:
    sink = RenderSink(buffers)
    header, pbullets = FakeTypedArray(4), FakeTypedArray(8)
    sink.attach("header", header)
    sink.attach("pbullets", pbullets)
    sink.flush(bulk=True)
    assert header.assigns == 1
    assert pbullets.got is buffers["pbullets"]
