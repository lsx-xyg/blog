// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { generateSelector } from "./selector";

function setup(html: string): Document {
  document.body.innerHTML = html;
  return document;
}

describe("generateSelector", () => {
  it("唯一 id 优先", () => {
    const doc = setup(`
      <div id="save-btn" class="btn btn-primary">保存</div>
      <div class="btn btn-primary">其他</div>
    `);
    const el = doc.getElementById("save-btn")!;
    expect(generateSelector(el)).toEqual({
      selector: "#save-btn",
      source: "id",
    });
  });

  it("无语义 id 时用语义属性（aria-label 优先）", () => {
    const doc = setup(`
      <button class="x" aria-label="发布文章">发布</button>
      <button class="x">草稿</button>
    `);
    const el = doc.querySelector("button[aria-label]")!;
    expect(generateSelector(el)).toEqual({
      selector: '[aria-label="发布文章"]',
      source: "semantic",
    });
  });

  it("没有语义属性时用唯一类组合", () => {
    const doc = setup(`
      <button class="btn save-article">保存</button>
      <button class="btn delete-article">删除</button>
      <button class="btn">普通</button>
    `);
    const el = doc.querySelector("button.save-article")!;
    const result = generateSelector(el)!;
    expect(result.source).toBe("class");
    expect(doc.querySelectorAll(result.selector)).toHaveLength(1);
  });

  it("同类元素多实例时回退类路径 + nth-child", () => {
    const doc = setup(`
      <ul>
        <li class="item">一</li>
        <li class="item">二</li>
        <li class="item">三</li>
      </ul>
    `);
    const el = doc.querySelectorAll("li.item")[1]!;
    const result = generateSelector(el)!;
    expect(result.source).toBe("path");
    expect(doc.querySelectorAll(result.selector)).toHaveLength(1);
    expect(doc.querySelector(result.selector)).toBe(el);
  });

  it("唯一性校验：非唯一候选全部跳过，最终兜底唯一", () => {
    const doc = setup(`
      <div class="card"><span>标题</span></div>
      <div class="card"><span>标题</span></div>
      <section id="unique-section"><span>标题</span></section>
    `);
    const el = doc.querySelector("#unique-section span")!;
    const result = generateSelector(el)!;
    // span 无语义属性、card 下非唯一 → 走唯一 id 祖先路径
    expect(doc.querySelectorAll(result.selector)).toHaveLength(1);
    expect(doc.querySelector(result.selector)).toBe(el);
  });

  it("空元素（无 id/语义/类）也至少产出 path 或 null，不抛异常", () => {
    const doc = setup(`<i></i><i></i>`);
    const el = doc.querySelectorAll("i")[0]!;
    const result = generateSelector(el);
    // 两个裸 <i> 无法唯一 → null 或抛错都算防御成功
    expect(() => generateSelector(el)).not.toThrow();
    if (result) {
      expect(doc.querySelectorAll(result.selector)).toHaveLength(1);
    }
  });

  it("语义属性值含引号时正确转义", () => {
    const doc = setup(`
      <div data-testid="say 'hi'">A</div>
      <div data-testid="other">B</div>
    `);
    const el = doc.querySelector('[data-testid="say \'hi\'"]')!;
    const result = generateSelector(el)!;
    expect(result.source).toBe("semantic");
    expect(doc.querySelectorAll(result.selector)).toHaveLength(1);
  });
});
