"""生成 public/datasets/ 下的示例数据集（HIF 格式），供“示例数据”下拉框切换。

数据来源：
- neurology：Hypergraph-DB tests/db 下的神经学库（Hyper-RAG 抽取，2.5 万实体），取度数最高的 100 个实体
  （另加默认中心 HUNTINGTON CHOREA）各自的邻域超边并集。原先内置的 src/data.js 是另一次抽取，超边没有描述
- nvda：英伟达超大规模云子图（金融，中文），hyper-master-paper 的 data/hypergraph.hif.json
- sanguo / xiyou：Hypergraph-DB tests/db 下的《三国演义》《西游记》库（.hgdb，需要 hyperdb 包）
- got：《权力的游戏》第一季，SimpleHypergraphs.jl 教程数据 hg_season1.json；超边为场景，节点为出场角色

用法（在装有 hyperdb 的环境中运行，如 Hypergraph-DB 的 .venv）:
  python scripts/build_datasets.py \
      --nvda hypergraph.hif.json --hgdb-dir ~/Hypergraph-DB/tests/db --got hg_season1.json
未提供的来源跳过，不覆盖已有文件。
"""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "datasets"
# 描述类字段截断长度：Hyper-RAG 抽取的描述是多段 <SEP> 拼接，全文会让文件大几倍
MAX_TEXT = 400
NODE_KEYS = ("entity_type", "description")
EDGE_KEYS = ("description", "keywords", "summary", "type", "weight")


def clip(value):
    return value[:MAX_TEXT] if isinstance(value, str) else value


def pick(attrs: dict, keys) -> dict:
    return {k: clip(attrs[k]) for k in keys if attrs.get(k) not in (None, "")}


def hif(nodes: dict[str, dict], edges: list[tuple[str, list[str], dict]], **metadata) -> dict:
    """nodes：id → attrs；edges：(超边名, 成员, attrs)。只保留有关联的节点"""
    used = {n for _, members, _ in edges for n in members}
    return {
        "network-type": "undirected",
        "metadata": metadata,
        "nodes": [{"node": n, "attrs": pick(nodes.get(n, {}), NODE_KEYS)} for n in nodes if n in used],
        "edges": [{"edge": name, "attrs": pick(attrs, EDGE_KEYS)} for name, _, attrs in edges],
        "incidences": [{"edge": name, "node": n} for name, members, _ in edges for n in members],
    }


def hgdb_ego(path: Path, name: str, top: int, extra_centers=()) -> dict:
    """度数最高的 top 个实体（及 extra_centers）各自的邻域超边并集；全库太大时用"""
    from hyperdb import HypergraphDB

    hg = HypergraphDB(str(path))
    centers = sorted(hg.all_v, key=lambda v: -hg.degree_v(v))[:top]
    centers += [c for c in extra_centers if hg.has_v(c) and c not in centers]
    edges = sorted({e for c in centers for e in hg.nbr_e_of_v(c)})
    nodes = {v: hg.v(v) for v in sorted({v for e in edges for v in e})}
    return hif(nodes, [("_".join(e), list(e), hg.e(e)) for e in edges], name=name)


def nvda(path: Path) -> dict:
    data = json.loads(path.read_text())
    nodes = {n["node"]: n.get("attrs", {}) for n in data["nodes"]}
    members: dict[str, list[str]] = {}
    for inc in data["incidences"]:
        members.setdefault(inc["edge"], []).append(inc["node"])
    edges = [(e["edge"], members.get(e["edge"], []), e.get("attrs", {})) for e in data["edges"]]
    return hif(nodes, [e for e in edges if e[1]], name="NVDA hyperscale cloud")


def hgdb(path: Path, name: str) -> dict:
    from hyperdb import HypergraphDB

    hg = HypergraphDB(str(path))
    # 排序：hgdb 的遍历顺序每次不同，固定顺序后重新生成的文件不会无意义地变动
    nodes = {v: hg.v(v) for v in sorted(hg.all_v)}
    edges = [("_".join(e), list(e), hg.e(e)) for e in sorted(hg.all_e)]
    return hif(nodes, edges, name=name)


def got(path: Path) -> dict:
    """第一季全部场景：同一组角色的场景合并为一条超边，只保留 ≥2 人的场景；按家族（姓氏出现 ≥2 次）分类"""
    d = json.loads(path.read_text())
    v2he, names, he_meta = (json.loads(d[k]) for k in ("v2he", "v_meta", "he_meta"))
    scenes: dict[int, set[str]] = {}
    for v, hes in enumerate(v2he):
        for h in hes:
            scenes.setdefault(int(h) - 1, set()).add(names[v].replace("_", " "))
    edges, seen = [], set()
    for i, meta in enumerate(he_meta):
        members = scenes.get(i, set())
        if len(members) >= 2 and frozenset(members) not in seen:
            seen.add(frozenset(members))
            scene, episode, season = meta.split("x")
            label = f"S{season}E{episode} scene {scene}"
            edges.append((label, sorted(members), {"type": f"Episode {episode}", "description": label}))
    people = sorted({n for _, m, _ in edges for n in m})
    surname = Counter(n.split()[-1] for n in people if len(n.split()) > 1)
    house = {n: n.split()[-1] if len(n.split()) > 1 and surname[n.split()[-1]] >= 2 else "Other" for n in people}
    nodes = {n: {"entity_type": house[n], "description": n} for n in people}
    return hif(nodes, edges, name="Game of Thrones S1")


def write(name: str, data: dict):
    OUT.mkdir(parents=True, exist_ok=True)
    out = OUT / f"{name}.hif.json"
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
    sizes = Counter(i["edge"] for i in data["incidences"]).values()
    print(f"{name}: nodes={len(data['nodes'])} edges={len(data['edges'])} (≥3: {sum(s >= 3 for s in sizes)}, "
          f"max {max(sizes)}) {out.stat().st_size / 1e6:.2f}MB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--nvda", type=Path)
    ap.add_argument("--hgdb-dir", type=Path)
    ap.add_argument("--got", type=Path)
    args = ap.parse_args()
    if args.nvda:
        write("nvda", nvda(args.nvda))
    if args.hgdb_dir:
        write("neurology", hgdb_ego(args.hgdb_dir / "neurology.hgdb", "Neurology", 100, ["HUNTINGTON CHOREA"]))
        write("sanguo", hgdb(args.hgdb_dir / "sanguo.hgdb", "三国演义"))
        write("xiyou", hgdb(args.hgdb_dir / "xiyou.hgdb", "西游记"))
    if args.got:
        write("got", got(args.got))


if __name__ == "__main__":
    main()
