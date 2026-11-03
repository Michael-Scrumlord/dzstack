import pytest

from reportly.errors import PluginError
from reportly.plugins import FormatBase, available_formats, get_format, load_plugins, register_format, unregister


@pytest.fixture
def scratch():
    created = []

    def make(**attrs):
        base = dict(name="scratch", extension=".scr", content_type="text/plain", description="a throwaway format")
        base.update(attrs)
        cls = type("Scratch", (FormatBase,), base)
        created.append(base["name"])
        return cls

    yield make
    for name in created:
        unregister(name)


def test_the_built_in_formats_are_found_without_importing_them():
    names = [f.name for f in available_formats()]
    assert names == sorted(names)
    assert "text" in names and "markdown" in names


def test_get_format_returns_the_registered_class():
    assert get_format("text").extension == ".txt"
    assert get_format("markdown").streaming is True


def test_unknown_format_lists_the_available_ones():
    with pytest.raises(PluginError, match=r"unknown format 'nope' \(available: .*markdown.*text"):
        get_format("nope")


def test_registering_makes_a_format_available(scratch):
    cls = register_format(scratch())
    assert get_format("scratch") is cls
    assert "scratch" in [f.name for f in available_formats()]


def test_registering_the_same_class_twice_is_fine(scratch):
    cls = scratch()
    register_format(cls)
    register_format(cls)


def test_a_name_that_is_taken_is_refused(scratch):
    register_format(scratch())
    with pytest.raises(PluginError, match="already taken"):
        register_format(scratch())


@pytest.mark.parametrize(
    "attrs, message",
    [
        ({"name": "Upper"}, "must match"),
        ({"name": "has space"}, "must match"),
        ({"name": ""}, "non-empty `name`"),
        ({"extension": "csv"}, "start with a dot"),
        ({"content_type": ""}, "non-empty `content_type`"),
        ({"description": ""}, "non-empty `description`"),
    ],
)
def test_bad_definitions_are_refused(scratch, attrs, message):
    with pytest.raises(PluginError, match=message):
        register_format(scratch(**attrs))


def test_only_format_subclasses_can_be_registered():
    with pytest.raises(PluginError, match="not a FormatBase subclass"):
        register_format(object)


def test_plugin_modules_are_imported():
    load_plugins(["json"])
    with pytest.raises(PluginError, match="cannot load plugin module 'no_such_module_here'"):
        load_plugins(["no_such_module_here"])
