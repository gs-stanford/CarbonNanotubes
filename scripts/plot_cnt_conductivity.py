#!/usr/bin/env python3
"""Plot CNT electrical conductivity landscape from the processed database."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
PROCESSED = ROOT / "data" / "processed"
FIGURES = ROOT / "figures"
VILATELA_DOI = "10.1126/science.aeb0673"


def clean_text(value: object) -> str:
    if value is None or pd.isna(value):
        return ""
    return str(value).strip()


def display_name(row: pd.Series) -> str:
    label = clean_text(row.get("record_label"))
    sample = clean_text(row.get("sample_name"))
    if label and sample and label.lower() != sample.lower():
        return f"{label}: {sample}"
    return sample or label or row["record_id"]


def load_plot_data() -> pd.DataFrame:
    records = pd.read_csv(PROCESSED / "combined_records.csv")
    pubs = pd.read_csv(PROCESSED / "publications_enriched.csv")
    records["doi_raw_norm"] = records["doi_raw"].fillna("").str.lower()

    pub_titles = {}
    pub_years = {}
    pub_journals = {}
    for _, pub in pubs.iterrows():
        doi = clean_text(pub.get("doi_verified") or pub.get("doi_input")).lower()
        if doi:
            pub_titles[doi] = clean_text(pub.get("title_verified"))
            pub_years[doi] = clean_text(pub.get("year_verified"))
            pub_journals[doi] = clean_text(pub.get("journal_verified"))

    conductors = records[
        records["electrical_conductivity_S_m"].notna()
        & records["density_kg_m3"].notna()
        & (records["electrical_conductivity_S_m"] > 0)
        & (records["density_kg_m3"] > 0)
        & records["material_family"].isin(["CNT_or_CNT_hybrid", "graphene_or_GO_fiber", "metal_comparator"])
    ].copy()

    conductors["electrical_conductivity_MS_m"] = conductors["electrical_conductivity_S_m"] / 1e6
    conductors["density_g_cm3_plot"] = conductors["density_kg_m3"] / 1000
    conductors["specific_conductivity_S_m2_kg_calc"] = conductors["electrical_conductivity_S_m"] / conductors["density_kg_m3"]
    conductors["specific_conductivity_kS_m2_kg"] = conductors["specific_conductivity_S_m2_kg_calc"] / 1000
    conductors["display_name"] = conductors.apply(display_name, axis=1)
    conductors["is_vilatela_2026"] = conductors["doi_raw_norm"].str.contains(VILATELA_DOI, regex=False)
    conductors["publication_title_for_plot"] = conductors["doi_raw_norm"].map(pub_titles).fillna("")
    conductors["publication_year_for_plot"] = conductors["doi_raw_norm"].map(pub_years).fillna("")
    conductors["publication_journal_for_plot"] = conductors["doi_raw_norm"].map(pub_journals).fillna("")

    if not conductors["is_vilatela_2026"].any():
        raise RuntimeError(f"Vilatela Science DOI {VILATELA_DOI} was not found in conductivity-capable records.")

    return conductors.sort_values("specific_conductivity_kS_m2_kg", ascending=False)


def choose_benchmark(data: pd.DataFrame, name: str) -> pd.Series:
    subset = data[data["display_name"].str.contains(name, case=False, na=False)]
    if subset.empty:
        subset = data[data["sample_name"].astype(str).str.contains(name, case=False, na=False)]
    if subset.empty:
        raise RuntimeError(f"Missing benchmark: {name}")
    return subset.sort_values("specific_conductivity_kS_m2_kg", ascending=False).iloc[0]


def annotate(ax: plt.Axes, row: pd.Series, label: str, dx: float = 1.05, dy: float = 1.05, color: str = "#111827") -> None:
    x = row["density_g_cm3_plot"]
    y = row["electrical_conductivity_MS_m"]
    ax.annotate(
        label,
        xy=(x, y),
        xytext=(x * dx, y * dy),
        textcoords="data",
        fontsize=5.8,
        color=color,
        arrowprops={"arrowstyle": "-", "lw": 0.4, "color": color, "shrinkA": 0, "shrinkB": 3},
    )


def plot(data: pd.DataFrame) -> dict[str, object]:
    FIGURES.mkdir(parents=True, exist_ok=True)
    plot_data_path = FIGURES / "cnt_conductivity_plot_data.csv"
    data.to_csv(plot_data_path, index=False)

    cnt = data[data["material_family"].eq("CNT_or_CNT_hybrid")].copy()
    graphene = data[data["material_family"].eq("graphene_or_GO_fiber")].copy()
    metals = data[data["material_family"].eq("metal_comparator")].copy()
    vilatela = data[data["is_vilatela_2026"]].iloc[0]
    copper = choose_benchmark(metals, "Copper")
    aluminum = choose_benchmark(metals, "Aluminum")

    copper_specific = copper["specific_conductivity_kS_m2_kg"]
    vilatela_specific = vilatela["specific_conductivity_kS_m2_kg"]
    ratio_vs_copper = vilatela_specific / copper_specific

    plt.rcParams.update(
        {
            "font.family": "sans-serif",
            "font.sans-serif": ["Arial", "Helvetica", "DejaVu Sans"],
            "font.size": 6.5,
            "axes.labelsize": 7,
            "axes.titlesize": 7,
            "xtick.labelsize": 6,
            "ytick.labelsize": 6,
            "legend.fontsize": 6,
            "figure.dpi": 160,
            "savefig.dpi": 300,
            "axes.edgecolor": "#111827",
            "axes.linewidth": 0.5,
            "pdf.fonttype": 42,
            "ps.fonttype": 42,
            "svg.fonttype": "none",
        }
    )

    fig = plt.figure(figsize=(183 / 25.4, 104 / 25.4), constrained_layout=False)
    gs = fig.add_gridspec(1, 2, width_ratios=[1.2, 0.95], left=0.075, right=0.985, top=0.88, bottom=0.18, wspace=0.38)
    ax = fig.add_subplot(gs[0, 0])
    ax_rank = fig.add_subplot(gs[0, 1])

    ax.scatter(
        cnt["density_g_cm3_plot"],
        cnt["electrical_conductivity_MS_m"],
        s=np.clip(cnt["specific_conductivity_kS_m2_kg"] * 4.0, 10, 54),
        c="#2563EB",
        alpha=0.72,
        edgecolors="white",
        linewidths=0.35,
        label="CNT / CNT-hybrid fibers",
        zorder=3,
    )
    if not graphene.empty:
        ax.scatter(
            graphene["density_g_cm3_plot"],
            graphene["electrical_conductivity_MS_m"],
            s=np.clip(graphene["specific_conductivity_kS_m2_kg"] * 4.0, 10, 54),
            marker="D",
            c="#059669",
            alpha=0.62,
            edgecolors="white",
            linewidths=0.35,
            label="Graphene / GO-CNT hybrids",
            zorder=2,
        )
    ax.scatter(
        metals["density_g_cm3_plot"],
        metals["electrical_conductivity_MS_m"],
        s=34,
        marker="s",
        c="#6B7280",
        alpha=0.75,
        edgecolors="white",
        linewidths=0.35,
        label="Metal benchmarks",
        zorder=2,
    )
    ax.scatter(
        [vilatela["density_g_cm3_plot"]],
        [vilatela["electrical_conductivity_MS_m"]],
        s=95,
        marker="*",
        c="#DC2626",
        edgecolors="#7F1D1D",
        linewidths=0.45,
        label="Vilatela group, Science 2026",
        zorder=5,
    )

    density_line = np.logspace(np.log10(0.08), np.log10(10.5), 200)
    ax.plot(density_line, copper_specific * density_line, color="#B45309", lw=0.7, ls="--", zorder=1)
    ax.text(0.14, copper_specific * 0.14 * 1.12, "same specific conductivity as Cu", color="#92400E", fontsize=5.8)

    for spec in [2, 10]:
        ax.plot(density_line, spec * density_line, color="#CBD5E1", lw=0.45, ls=":", zorder=0)

    annotate(ax, vilatela, "Intercalated CNT fiber\nScience 2026", dx=1.08, dy=0.72, color="#991B1B")
    annotate(ax, copper, "Cu", dx=0.76, dy=1.18, color="#92400E")
    annotate(ax, aluminum, "Al", dx=0.68, dy=0.75, color="#374151")

    ax.set_xscale("log")
    ax.set_yscale("log")
    ax.set_xlim(0.08, 11)
    ax.set_ylim(0.008, 80)
    ax.set_xlabel("Density, rho (g cm$^{-3}$)")
    ax.set_ylabel("Electrical conductivity, sigma (MS m$^{-1}$)")
    ax.set_title("Density versus electrical conductivity", loc="left", fontweight="bold", pad=4)
    ax.grid(True, which="major", color="#E5E7EB", lw=0.35)
    ax.grid(True, which="minor", color="#F1F5F9", lw=0.25)
    ax.legend(loc="lower left", frameon=False)
    ax.text(-0.12, 1.05, "a", transform=ax.transAxes, fontsize=8, fontweight="bold", va="bottom", ha="left")

    top_rank = cnt.copy()
    top_rank["rank_label"] = top_rank.apply(lambda row: "Vilatela 2026 Science" if row["is_vilatela_2026"] else clean_text(row["record_label"]) or clean_text(row["sample_name"]), axis=1)
    top_rank = top_rank.sort_values("specific_conductivity_kS_m2_kg", ascending=False).drop_duplicates("rank_label", keep="first").head(8).iloc[::-1]
    colors = ["#DC2626" if flag else "#2563EB" for flag in top_rank["is_vilatela_2026"]]
    ax_rank.barh(top_rank["rank_label"], top_rank["specific_conductivity_kS_m2_kg"], color=colors, alpha=0.88)
    ax_rank.axvline(copper_specific, color="#B45309", lw=0.8, ls="--")
    ax_rank.text(
        copper_specific * 1.04,
        0.35,
        "Cu benchmark",
        color="#92400E",
        fontsize=5.8,
        va="center",
        bbox={"facecolor": "white", "edgecolor": "none", "alpha": 0.85, "pad": 1.5},
    )
    ax_rank.set_xlabel("Specific electrical conductivity, sigma/rho (kS m$^2$ kg$^{-1}$)")
    ax_rank.set_title("Top CNT-family entries in current seed database", loc="left", fontweight="bold", pad=4)
    ax_rank.grid(axis="x", color="#E5E7EB", lw=0.35)
    ax_rank.set_axisbelow(True)
    ax_rank.spines["top"].set_visible(False)
    ax_rank.spines["right"].set_visible(False)
    ax_rank.text(-0.13, 1.05, "b", transform=ax_rank.transAxes, fontsize=8, fontweight="bold", va="bottom", ha="left")

    fig.suptitle(
        "CNT fibers now exceed copper by specific electrical conductivity",
        x=0.01,
        y=0.985,
        ha="left",
        fontsize=7,
        fontweight="bold",
    )
    fig.text(
        0.01,
        0.035,
        "Source: processed CNT review seed database. Specific conductivity calculated as sigma/rho from canonical S/m and kg/m3 fields. "
        "Seed records are not fully deduplicated; use as a curation check, not a final meta-analysis.",
        fontsize=5.5,
        color="#475569",
    )

    png = FIGURES / "cnt_conductivity_landscape.png"
    svg = FIGURES / "cnt_conductivity_landscape.svg"
    pdf = FIGURES / "cnt_conductivity_landscape.pdf"
    fig.savefig(png, bbox_inches="tight")
    fig.savefig(svg, bbox_inches="tight")
    fig.savefig(pdf, bbox_inches="tight")
    plt.close(fig)

    summary = {
        "plot_data": str(plot_data_path.relative_to(ROOT)),
        "png": str(png.relative_to(ROOT)),
        "svg": str(svg.relative_to(ROOT)),
        "pdf": str(pdf.relative_to(ROOT)),
        "cnt_records_with_density_and_conductivity": int(len(cnt)),
        "graphene_or_go_records_with_density_and_conductivity": int(len(graphene)),
        "metal_benchmarks_with_density_and_conductivity": int(len(metals)),
        "vilatela_density_g_cm3": float(vilatela["density_g_cm3_plot"]),
        "vilatela_conductivity_MS_m": float(vilatela["electrical_conductivity_MS_m"]),
        "vilatela_specific_kS_m2_kg": float(vilatela_specific),
        "copper_specific_kS_m2_kg": float(copper_specific),
        "vilatela_specific_vs_copper_ratio": float(ratio_vs_copper),
    }
    (FIGURES / "cnt_conductivity_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    data = load_plot_data()
    summary = plot(data)
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
