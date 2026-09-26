# 节奏小节校对

一个用于校对乐谱小节时值的网页工具（React + TypeScript）。粘贴含拍号与逐小节事件树的
JSON，即可逐小节核对**应有时值 / 实际时值 / 不足或超出量**；超出时定位**首个越界叶事件**
的树路径，非法输入逐条指出树路径。所有时值以全音符为 1，用精确分数递归计算。

## 启动

```bash
docker compose up --build
```

访问 **http://localhost:8080**（容器内 80 端口映射到本机 8080）。依赖安装已包含在镜像
构建过程中，启动即可使用，页面预置了可编辑示例与格式说明。

## JSON 格式

```json
{
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "measures": [
    {
      "events": [
        { "type": "note", "denominator": 4, "dot": true },
        { "type": "rest", "denominator": 8 },
        {
          "type": "tuplet",
          "actual": 3,
          "occupied": 2,
          "children": [{ "type": "note", "denominator": 8 }]
        }
      ]
    }
  ]
}
```

- `note` / `rest`：`denominator` 表示全音符的几分之一，可选 `dot: true` 带一个附点（×3/2）
- `tuplet`：`actual` 实际数、`occupied` 占用数、`children` 子事件；组内时值乘
  `occupied/actual`，最多三层嵌套
- 拍号分子、连音两数须为正整数；拍号 / 音符 / 休止符分母限 1、2、4、8、16、32
- 小节应有时值 = 拍号分子 / 拍号分母

## 本地开发

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查并打包到 dist/
```
