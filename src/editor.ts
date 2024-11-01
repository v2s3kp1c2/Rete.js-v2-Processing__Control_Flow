import { createRoot } from "react-dom/client";
import { NodeEditor, GetSchemes, ClassicPreset } from "rete";
import { AreaPlugin, AreaExtensions } from "rete-area-plugin";
import {
  ConnectionPlugin,
  Presets as ConnectionPresets
} from "rete-connection-plugin";
import { ReactPlugin, Presets, ReactArea2D } from "rete-react-plugin";
import {
  AutoArrangePlugin,
  Presets as ArrangePresets
} from "rete-auto-arrange-plugin";
import { ControlFlowEngine } from "rete-engine";
import {
  ContextMenuExtra,
  ContextMenuPlugin,
  Presets as ContextMenuPresets
} from "rete-context-menu-plugin";

const socket = new ClassicPreset.Socket("socket");

class Start extends ClassicPreset.Node<{}, { exec: ClassicPreset.Socket }, {}> {
  width = 180;
  height = 90;

  constructor() {
    super("Start");
    this.addOutput("exec", new ClassicPreset.Output(socket, "Exec"));
  }

  execute(_: never, forward: (output: "exec") => void) {
    forward("exec");
  }
}

class Log extends ClassicPreset.Node<
  { exec: ClassicPreset.Socket },
  { exec: ClassicPreset.Socket },
  { message: ClassicPreset.InputControl<"text"> }
> {
  width = 180;
  height = 150;

  constructor(message: string, private log: (text: string) => void) {
    super("Log");
    const control = new ClassicPreset.InputControl("text", {
      initial: message
    });

    this.addInput("exec", new ClassicPreset.Input(socket, "Exec", true));
    this.addControl("message", control);
    this.addOutput("exec", new ClassicPreset.Output(socket, "Exec"));
  }

  execute(input: "exec", forward: (output: "exec") => void) {
    this.log(this.controls.message.value as string);

    forward("exec");
  }
}

class Delay extends ClassicPreset.Node<
  { exec: ClassicPreset.Socket },
  { exec: ClassicPreset.Socket },
  { value: ClassicPreset.InputControl<"number"> }
> {
  width = 180;
  height = 150;

  constructor(seconds: number) {
    super("Delay");
    this.addInput("exec", new ClassicPreset.Input(socket, "Exec", true));
    this.addControl(
      "value",
      new ClassicPreset.InputControl("number", { initial: seconds })
    );
    this.addOutput("exec", new ClassicPreset.Output(socket, "Exec"));
  }

  execute(input: "exec", forward: (output: "exec") => void) {
    const value = this.controls.value.value;
    setTimeout(
      () => {
        forward("exec");
      },
      value ? value * 1000 : 1000
    );
  }
}

class Connection<
  A extends NodeProps,
  B extends NodeProps
> extends ClassicPreset.Connection<A, B> {
  isLoop?: boolean;
}

type NodeProps = Start | Log | Delay;
type ConnProps =
  | Connection<Start, Log>
  | Connection<Delay, Log>
  | Connection<Log, Delay>
  | Connection<Log, Log>
  | Connection<Delay, Delay>;

type Schemes = GetSchemes<NodeProps, ConnProps>;

type AreaExtra = ReactArea2D<any> | ContextMenuExtra;

export async function createEditor(
  container: HTMLElement,
  log: (text: string) => void
) {
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const render = new ReactPlugin<Schemes, AreaExtra>({ createRoot });
  const arrange = new AutoArrangePlugin<Schemes>();
  const engine = new ControlFlowEngine<Schemes>();
  const contextMenu = new ContextMenuPlugin<Schemes>({
    items: ContextMenuPresets.classic.setup([
      ["Start", () => new Start()],
      ["Log", () => new Log("", log)],
      ["Delay", () => new Delay(1)]
    ])
  });
  area.use(contextMenu);

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl()
  });

  render.addPreset(Presets.contextMenu.setup());
  render.addPreset(Presets.classic.setup());

  connection.addPreset(ConnectionPresets.classic.setup());

  arrange.addPreset(ArrangePresets.classic.setup());

  editor.use(engine);
  editor.use(area);
  area.use(connection);
  area.use(render);
  area.use(arrange);

  AreaExtensions.simpleNodesOrder(area);
  AreaExtensions.showInputControl(area);

  const start = new Start();
  const log1 = new Log("log before delay", log);
  const delay = new Delay(2);
  const log2 = new Log("log after delay", log);

  const con1 = new Connection(start, "exec", log1, "exec");
  const con2 = new Connection(log1, "exec", delay, "exec");
  const con3 = new Connection(delay, "exec", log2, "exec");
  const con4 = new Connection(log2, "exec", log1, "exec");

  con4.isLoop = true;

  await editor.addNode(start);
  await editor.addNode(log1);
  await editor.addNode(delay);
  await editor.addNode(log2);

  await editor.addConnection(con1);
  await editor.addConnection(con2);
  await editor.addConnection(con3);
  await editor.addConnection(con4);

  engine.execute(start.id);

  await arrange.layout();
  AreaExtensions.zoomAt(area, editor.getNodes());

  return {
    destroy: () => area.destroy()
  };
}
