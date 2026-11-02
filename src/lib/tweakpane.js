class DummyPane {
  addFolder() { return this; }
  addBinding() { return { on: () => {} }; }
  addButton() { return { on: () => {} }; }
  refresh() {}
}

const TweakPane = {
  Pane: DummyPane,
};

export default TweakPane;

