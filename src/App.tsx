import { useCallback } from "react";
import { message } from "antd";
import { createEditor } from "./editor";
import { useRete } from "rete-react-plugin";

export default function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const create = useCallback(
    (el: HTMLElement) => {
      return createEditor(el, messageApi.info);
    },
    [messageApi]
  );
  const [ref] = useRete(create);

  return (
    <div className="App">
      {contextHolder}
      <div ref={ref} style={{ height: "100vh", width: "100vw" }}></div>
    </div>
  );
}
