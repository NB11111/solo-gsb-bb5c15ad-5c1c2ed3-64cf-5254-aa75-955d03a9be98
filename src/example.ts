/** 可编辑示例：覆盖「吻合 / 不足 / 超出 / 嵌套连音」四种情形 */
export const EXAMPLE_TEXT = `{
  "timeSignature": { "numerator": 4, "denominator": 4 },
  "measures": [
    {
      "events": [
        { "type": "note", "denominator": 4, "dot": true },
        { "type": "note", "denominator": 8 },
        {
          "type": "tuplet",
          "actual": 3,
          "occupied": 2,
          "children": [
            { "type": "note", "denominator": 8 },
            { "type": "note", "denominator": 8 },
            { "type": "rest", "denominator": 8 }
          ]
        },
        { "type": "rest", "denominator": 4 }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 4 },
        { "type": "note", "denominator": 4 }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 1 },
        { "type": "note", "denominator": 8 }
      ]
    },
    {
      "events": [
        { "type": "note", "denominator": 2, "dot": true },
        {
          "type": "tuplet",
          "actual": 3,
          "occupied": 2,
          "children": [
            { "type": "note", "denominator": 8 },
            {
              "type": "tuplet",
              "actual": 3,
              "occupied": 2,
              "children": [
                { "type": "note", "denominator": 16 },
                { "type": "note", "denominator": 16 },
                { "type": "note", "denominator": 16 }
              ]
            },
            { "type": "note", "denominator": 8 }
          ]
        }
      ]
    }
  ]
}
`;
