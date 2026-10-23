#!/usr/bin/env python3
"""Calibrate Liu SI figure values without modifying curated or public records."""

import argparse
import hashlib
import json
from pathlib import Path
import tempfile

import numpy as np
from PIL import Image, ImageDraw
import pymupdf


ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / "outputs/fiber_discovery_20261022/graphene_draw_audit"
PDF = ARCHIVE / "41563_2026_2733_MOESM1_ESM.pdf"
MAIN = ARCHIVE / "article.pdf"
OUTPUT = ARCHIVE / "omitted_figure_values.json"
DOI = "10.1038/s41563-026-02733-0"
EXPECTED_SI = "f91f3a0d70eb05fa05962fc7fe94ccc20ec5edde7e98337e1e6f6784539020aa"
EXPECTED_MAIN = "a93ebf63420fc13a50e087afad5861d25e880b20d45e02f44d2c1d7a816c7ba9"
BASE_URL = ("https://media.springernature.com/original/springer-static/esm/"
            "art%3A10.1038%2Fs41563-026-02733-0/MediaObjects/")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def native_image(doc, page_number):
    """Join native strips without interpolation; retain every strip's PDF map."""
    page = doc[page_number - 1]
    images = sorted(page.get_images(full=True),
                    key=lambda item: page.get_image_rects(item[0])[0].y0)
    arrays, maps = [], []
    start = 0
    for info in images:
        pix = pymupdf.Pixmap(doc, info[0])
        assert pix.n == 3 and not pix.alpha
        array = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3)
        rect = page.get_image_rects(info[0])[0]
        arrays.append(array)
        maps.append(dict(xref=info[0], width_px=pix.width, height_px=pix.height,
                         native_y_start=start, native_y_stop=start + pix.height,
                         pdf_rect_pt=list(rect), pixel_sha256=hashlib.sha256(pix.samples).hexdigest()))
        start += pix.height
    assert len({a.shape[1] for a in arrays}) == 1
    return np.concatenate(arrays), maps


def pixel_to_pdf(x, y, maps):
    strip = next(m for m in maps if m["native_y_start"] <= y < m["native_y_stop"])
    x0, y0, x1, y1 = strip["pdf_rect_pt"]
    return [x0 + (x + .5) / strip["width_px"] * (x1 - x0),
            y0 + (y - strip["native_y_start"] + .5) / strip["height_px"] * (y1 - y0)]


def tick_center(array, box, direction):
    x0, y0, x1, y1 = box
    dark = array[y0:y1, x0:x1].max(axis=2) < 100
    profile = dark.sum(axis=1 if direction == "y" else 0)
    assert profile.max() > 0, ("No axis ink in tick ROI", box)
    selected = np.flatnonzero(profile >= profile.max() * .75)
    assert len(selected) and selected[-1] - selected[0] < 5, (box, selected)
    return float(selected.mean() + (y0 if direction == "y" else x0))


def calibration(coordinates, values, unit, tick_boxes=None):
    slope, intercept = np.polyfit(coordinates, values, 1)
    residual = np.polyval([slope, intercept], coordinates) - values
    coordinate_residual = float(np.max(np.abs(residual)) / abs(slope))
    assert coordinate_residual < 1.5
    return dict(coordinate_to_value=[float(slope), float(intercept)],
                tick_coordinates=list(coordinates), tick_values=list(values),
                tick_roi_native_px=tick_boxes, unit=unit,
                maximum_tick_residual=float(np.max(np.abs(residual))),
                maximum_tick_residual_coordinate=coordinate_residual,
                coordinate_convention="zero-based native pixel centers, or PDF points for vectors")


def value_at(cal, coordinate):
    return float(np.polyval(cal["coordinate_to_value"], coordinate))


def circle_center(array, seed, color, radius):
    """Fit chromatic ring pixels, excluding center dots and achromatic SD bars."""
    x, y = seed
    half = radius + 5
    roi = array[y-half:y+half+1, x-half:x+half+1].astype(int)
    yy, xx = np.indices(roi.shape[:2])
    xx, yy = xx + x - half, yy + y - half
    distance = np.hypot(xx - x, yy - y)
    results = []
    for threshold in [40, 60, 80]:
        r, g, b = (roi[:, :, j] for j in range(3))
        if color == "blue":
            mask = (b-r > threshold) & (b-g > 15) & (b > 100)
        else:
            mask = (r-g > threshold) & (r-b > 30) & (r > 130)
        mask &= (distance > radius-6) & (distance < radius+4)
        dx, dy = xx[mask] - x, yy[mask] - y
        assert len(dx) > 120
        fit = np.linalg.lstsq(np.column_stack([2*dx, 2*dy, np.ones_like(dx)]),
                              dx*dx + dy*dy, rcond=None)[0]
        center = [float(x+fit[0]), float(y+fit[1])]
        fitted_radius = float(np.sqrt(fit[2] + fit[0]**2 + fit[1]**2))
        assert radius-3 < fitted_radius < radius+3
        results.append(dict(chromatic_threshold=threshold, center_native_px=center,
                            fitted_radius_px=fitted_radius, selected_pixels=len(dx)))
    chosen = results[1]
    span = max(abs(r["center_native_px"][1] - chosen["center_native_px"][1]) for r in results)
    assert span < 1.5
    return dict(center_native_px=chosen["center_native_px"], radius_px=chosen["fitted_radius_px"],
                color=color, seed_native_px=list(seed), seed_window_halfwidth_px=half,
                threshold_fits=results, center_threshold_sensitivity_y_px=span)


def cap_center(array, x, seed_y):
    """Locate a visually identified SD cap by side pixels, excluding its stem."""
    x, seed_y = int(round(x)), int(round(seed_y))
    half = 13
    roi = array[seed_y-4:seed_y+5, x-half:x+half+1].astype(int)
    luminosity = roi.mean(axis=2)
    positions, counts = [], []
    for tolerance in [25, 35, 45]:
        mask = ((roi.max(axis=2)-roi.min(axis=2) < tolerance)
                & (luminosity > 40) & (luminosity < 190))
        mask[:, half-3:half+4] = False
        weights = mask.sum(axis=1)
        assert weights.sum() >= 3, (x, seed_y, tolerance)
        counts.append(int(weights.sum()))
        positions.append(float(np.average(np.arange(seed_y-4, seed_y+5), weights=weights)))
    assert max(positions)-min(positions) < 2
    return dict(y_native_px=positions[1], seed_y_px=seed_y,
                roi_native_px=[x-half, seed_y-4, x+half+1, seed_y+5],
                achromatic_thresholds=[25, 35, 45], threshold_centers_y_px=positions,
                selected_side_pixel_counts=counts,
                coordinate_sensitivity_px=max(2., max(positions)-min(positions)))


def raster_measurement(ring, cal, maps, unit, canonical_factor, caps=None):
    x, y = ring["center_native_px"]
    value = value_at(cal, y)
    center_pixels = 1 + ring["center_threshold_sensitivity_y_px"]
    sensitivity = abs(cal["coordinate_to_value"][0])*center_pixels + cal["maximum_tick_residual"]
    result = dict(value_reported_unit=value, reported_unit=unit,
                  value_canonical=value*canonical_factor, conversion_factor_to_canonical=canonical_factor,
                  extraction_method="native_raster_calibrated_chromatic_ring_fit",
                  reported_or_derived="reported", statistic_type="unspecified",
                  uncertainty_type="not_reported", uncertainty_value_reported=None,
                  uncertainty_value_canonical=None, sample_size_n=None,
                  marker=ring, center_pdf_pt=pixel_to_pdf(x, y, maps),
                  digitization_sensitivity_reported_unit=sensitivity,
                  digitization_interval_reported_unit=[value-sensitivity, value+sensitivity],
                  digitization_sensitivity_definition=(
                      "One native pixel plus threshold-fit center variation, plus maximum tick-fit residual; "
                      "a coordinate sensitivity envelope, not experimental SD, SE or confidence interval."),
                  source_qualification="Figure-digitized; retained digits are extraction coordinates, not measurement precision.",
                  status="admission_ready_figure_digitized")
    if caps:
        ytop, ybottom = [cap["y_native_px"] for cap in caps]
        assert ytop < y < ybottom
        sd = abs(value_at(cal, ytop) - value_at(cal, ybottom)) / 2
        sd_sensitivity = abs(cal["coordinate_to_value"][0])*max(
            cap["coordinate_sensitivity_px"] for cap in caps) + cal["maximum_tick_residual"]
        result.update(statistic_type="mean", uncertainty_type="standard_deviation",
                      uncertainty_value_reported=sd, uncertainty_value_canonical=sd*canonical_factor,
                      sample_size_n=3, replicate_type="independent technical replicates",
                      uncertainty_source="Fig.38 caption: mean +/- one standard deviation, n=3",
                      error_caps=caps, error_cap_midpoint_offset_px=(ytop+ybottom)/2-y,
                      digitization_sensitivity_sd_reported_unit=sd_sensitivity,
                      resolution_limited_sd=sd_sensitivity/sd > .20,
                      resolution_limited_sd_definition="Coordinate sensitivity exceeds 20 percent of the source SD; mean remains resolved.")
        if result["resolution_limited_sd"]:
            result["status"] = "admission_ready_mean_with_resolution_limited_SD_precision"
        assert abs(result["error_cap_midpoint_offset_px"]) < 2
    return result


def save_crop(array, box, qa, name, rings=(), tick_lines=(), caps=()):
    im = Image.fromarray(array).crop(box)
    raw = qa / f"{name}_source.png"
    im.save(raw)
    overlay = im.copy()
    draw = ImageDraw.Draw(overlay)
    x0, y0 = box[:2]
    for ring in rings:
        x, y = ring["center_native_px"]
        x, y = x-x0, y-y0
        draw.line((x-7,y,x+7,y), fill=(0,155,0), width=2)
        draw.line((x,y-7,x,y+7), fill=(0,155,0), width=2)
    for x, y in caps:
        draw.line((x-x0-9,y-y0,x-x0+9,y-y0), fill=(190,0,190), width=1)
    for y in tick_lines:
        draw.line((0,y-y0,overlay.width,y-y0), fill=(0,180,180), width=1)
    marked = qa / f"{name}_calibration.png"
    overlay.save(marked)
    return dict(source_crop=str(raw), calibrated_crop=str(marked),
                native_crop_box=list(box), source_crop_sha256=sha(raw), calibrated_crop_sha256=sha(marked))


def extract_raman(doc, qa, packet):
    a, maps = native_image(doc, 54)
    yboxes = [[1400,y-4,1434,y+5] for y in [154,374,593,814,1033]]
    yboxes[-1] = [1438,1029,1460,1038]
    yticks = [tick_center(a, box, "y") for box in yboxes]
    ycal = calibration(yticks, [.04,.03,.02,.01,0.], "I_D/I_G", yboxes)
    xboxes = [[x-4,1037,x+5,1049] for x in [1434,1606,1777,1948,2119,2289]]
    xticks = [tick_center(a, box, "x") for box in xboxes]
    xcal = calibration(xticks, [0,2,4,6,8,10], "draw_ratio", xboxes)
    records, rings = [], []
    seeds = [(1520,130),(1606,171),(1776,211),(1948,458),(2118,662),(2289,918)]
    for draw, seed in zip([1,2,4,6,8,10], seeds):
        ring = circle_center(a, seed, "blue", 23)
        rings.append(ring)
        assert abs(value_at(xcal, ring["center_native_px"][0])-draw) < .02
        raw = raster_measurement(ring, ycal, maps, "I_D/I_G", 1)
        lo, hi = raw["digitization_interval_reported_unit"]
        assert lo > 0
        dg = raw["value_reported_unit"]
        ys, vs = ycal["tick_coordinates"], ycal["tick_values"]
        independent_slope = (vs[-1]-vs[0])/(ys[-1]-ys[0])
        independent_value = vs[0] + independent_slope*(ring["center_native_px"][1]-ys[0])
        assert abs(independent_value-dg) < raw["digitization_sensitivity_reported_unit"]
        raw["independent_two_tick_check_value"] = independent_value
        interval = [1/hi, 1/lo]
        reciprocal = dict(property="g_d_ratio", value_canonical=1/dg, unit_canonical="dimensionless",
                          reported_or_derived="derived", derivation_formula="G:D = 1 / digitized (I_D/I_G)",
                          statistic_type="unspecified", uncertainty_type="not_reported",
                          uncertainty_value_canonical=None, sample_size_n=None,
                          digitization_sensitivity_interval=interval,
                          digitization_sensitivity_lower=1/dg-interval[0],
                          digitization_sensitivity_upper=interval[1]-1/dg,
                          resolution_limited=max(abs(v-1/dg) for v in interval)/(1/dg) > .05,
                          status="admission_ready_derived_reciprocal_of_digitized_ratio")
        state = f"{DOI}|draw-{draw}"
        match = next((r for r in packet["records"] if r["curated_state_id"] == state), None)
        records.append(dict(draw_ratio=draw, curated_state_id=state,
                            source_series_key=f"{DOI}|SI.Fig47b",
                            existing_record_id=match["record_id"] if match else None,
                            state_mapping_status="same_explicit_draw_label_in_final_GF_series",
                            admission_action="append_Raman_only_to_existing_draw_state" if match else "new_draw_2_Raman_only_state",
                            allowed_additional_properties=["g_d_ratio"],
                            prohibited_borrowing="No T, E, density, electrical or thermal values copied to draw 2 or gauge records.",
                            raw_d_g=raw, g_d=reciprocal,
                            source_locator=f"SI PDF p.54 / printed p.53, Fig.47b, blue I_D/I_G circle, draw {draw}",
                            conditions_notes=("Final graphene-fibre drawing series. Integrated-band ratio convention from main PDF p.11; "
                                              "SI caption uses peak-intensity wording. Excitation wavelength, n and experimental uncertainty "
                                              "not recovered. G/D is a reciprocal of a digitized D/G point, not a directly reported G/D mean.")))
    crop = save_crop(a, (1280,0,2570,1120), qa, "fig47b", rings, yticks)
    return dict(pdf_page=54, printed_page=53, figure="47b", native_strip_maps=maps,
                native_canvas_size_px=[a.shape[1], a.shape[0]],
                calibration=dict(x=xcal, d_g=ycal), records=records, visual_crop=crop,
                reported_uncertainty="No error bars, SD or n specified for this series.")


def extract_thermal(doc, qa):
    a, maps = native_image(doc, 45)
    dboxes = [[1870,y-4,1901,y+5] for y in [1757,1879,2002,2124,2246,2369]]
    rboxes = [[2599,y-4,2620,y+5] for y in [1696,1859,2022,2185,2348]]
    dticks = [tick_center(a,b,"y") for b in dboxes]
    rticks = [tick_center(a,b,"y") for b in rboxes]
    dcal = calibration(dticks, [18,16,14,12,10,8], "um", dboxes)
    rcal = calibration(rticks, [2.2,2.,1.8,1.6,1.4], "g/cm^3", rboxes)
    dseeds = [(1988,1812),(2163,2168),(2337,2271),(2511,2351)]
    rseeds = [(1988,2324),(2163,2185),(2337,2022),(2511,1818)]
    dcap_seeds = [(1791,1832),(2149,2185),(2259,2283),(2340,2360)]
    rcap_seeds = [(2299,2349),(2168,2203),(2010,2034),(1807,1829)]
    names = ["UrDGOF","UrDGF-200","UrDGF-1600","UrDGF-2800"]
    records, rings, caps_for_crop = [], [], []
    for i, name in enumerate(names):
        dr = circle_center(a, dseeds[i], "blue", 16)
        rr = circle_center(a, rseeds[i], "red", 16)
        rings.extend([dr, rr])
        dcaps = [cap_center(a, dr["center_native_px"][0], y) for y in dcap_seeds[i]]
        rcaps = [cap_center(a, rr["center_native_px"][0], y) for y in rcap_seeds[i]]
        for ring, caps in [(dr,dcaps),(rr,rcaps)]:
            caps_for_crop.extend((ring["center_native_px"][0], c["y_native_px"]) for c in caps)
        diameter = raster_measurement(dr, dcal, maps, "um", 1e-6, dcaps)
        density = raster_measurement(rr, rcal, maps, "g/cm^3", 1000, rcaps)
        diameter.update(property="diameter", unit_canonical="m",
                        cross_section_method="Reported diameter; equivalent-area versus width definition not specified; noncircular sections shown.")
        density.update(property="density", unit_canonical="kg/m^3",
                       density_basis="sink_float_density_not_verified_outer_area_bulk_density")
        possible_overlap = ([f"{DOI}|precursor-gof-draw-10"] if i==0 else
                            [f"{DOI}|draw-10"] if i==3 else [])
        density["admission_action"] = "add_to_separate_thermal_measurement_set_preserve_pairing"
        diameter["admission_action"] = "add_to_separate_thermal_summary_state_not_draw_or_gauge"
        records.append(dict(source_state_label=name,
                            curated_state_id=f"{DOI}|thermal-summary-{name.lower()}",
                            source_series_key=f"{DOI}|SI.Fig38e",
                            measurement_set_id=f"{DOI}|SI.Fig38e|{name}",
                            draw_ratio=None, treatment_temperature_C=[None,200,1600,2800][i],
                            state_mapping_status="thermal_summary_identity_preserved_draw_ratio_not_explicit_in_Fig38",
                            material_state=["GO fibre before thermal reduction","thermally reduced GO fibre",
                                            "carbonized graphene fibre","graphitized graphene fibre"][i],
                            source_locator=f"SI PDF p.45 / printed p.44, Fig.38e, {name}",
                            measurements=dict(diameter=diameter,density=density),
                            possible_overlap=possible_overlap,
                            independent_population_confirmed=False,
                            independence_status="not_established",
                            overlap_resolution="unresolved_no_source_proof_of_reused_specimens" if possible_overlap else "not_applicable",
                            overlap_counting_policy="Do not sum n or treat possible-overlap measurement sets as independent populations; retain one publication.",
                            conditions_notes=("Separate named thermal-treatment summary; no borrowed mechanical/transport values. "
                                              "n=3 technical replicates, mean +/- SD. Source SD and coordinate sensitivity remain separate. "
                                              + ("Possible overlap with another named source series; repeated measurements are not proven identical or independent. "
                                                 "Retain the paired diameter and density; do not copy either to the possible-overlap state." if possible_overlap else ""))))
    crop = save_crop(a, (1770,1640,2744,2571), qa, "fig38e", rings, dticks+rticks, caps_for_crop)
    return dict(pdf_page=45, printed_page=44, figure="38e", native_strip_maps=maps,
                native_canvas_size_px=[a.shape[1], a.shape[0]],
                calibration=dict(diameter=dcal,density=rcal), records=records, visual_crop=crop,
                identity_review=dict(
                    main_locator="Main PDF p.5, section Structure and performance of ultrahigh-ratio drawn GFs",
                    supporting_evidence="Main text associates obtained UrDGFs (draw ratio 10) with dense cross-section morphology; thermal evolution cites SI Figs.35-43.",
                    limitation="Fig.38 itself gives thermal-state labels but no draw ratio or specimen IDs. Context supports an association, not a confirmed measurement-set identity.",
                    decision="Retain all four paired thermal measurement sets with source_series_key and possible_overlap. Do not merge into draw-10/precursor-10 or count as confirmed independent populations; no endpoint identity proof exists."))


def extract_precursor(doc, qa):
    page = doc[42]
    paths = page.get_drawings()
    yids, xids = list(range(126,134)), list(range(111,117))
    ycal = calibration([float(paths[i]["rect"].y0) for i in yids],
                       [.8,1.,1.2,1.4,1.6,1.8,2.,2.2], "g/cm^3")
    xcal = calibration([float(paths[i]["rect"].x0) for i in xids], [0,2,4,6,8,10], "draw_ratio")
    ycal["tick_path_indices"], xcal["tick_path_indices"] = yids, xids
    records = []
    for draw, marker, error_ids in zip([1,4,6,8,10], range(24,29),
                                      [(65,67),(69,71),(73,75),(77,79),(81,83)]):
        p = paths[marker]
        assert len(p["items"]) == 4 and all(v[0] == "l" for v in p["items"])
        assert max(p["color"])-min(p["color"]) < 1e-5
        rect = p["rect"]
        x, y = (rect.x0+rect.x1)/2, (rect.y0+rect.y1)/2
        assert abs(value_at(xcal,x)-draw) < .01
        caps = [float(paths[j]["rect"].y0) for j in error_ids]
        for j in error_ids:
            assert abs(paths[j]["rect"].height) < 1e-5 and paths[j]["rect"].width > 5
        mean, sd = value_at(ycal,y), abs(value_at(ycal,caps[0])-value_at(ycal,caps[1]))/2
        sensitivity = abs(ycal["coordinate_to_value"][0])*.5 + ycal["maximum_tick_residual"]
        assert sd > sensitivity
        records.append(dict(draw_ratio=draw, curated_state_id=f"{DOI}|precursor-gof-draw-{draw}",
                            source_series_key=f"{DOI}|SI.Fig36|GOFs",
                            material_state="GOF precursor, not graphitized GFs-2800",
                            source_locator=f"SI PDF p.43 / printed p.42, Fig.36, grey GOFs diamond at draw {draw}",
                            state_mapping_status="explicit_GOF_precursor_series_and_draw_label",
                            admission_action="new_precursor_density_only_state",
                            prohibited_borrowing="No graphitized-fibre T, E, sigma, kappa or Raman values copied.",
                            density=dict(property="density", reported_unit="g/cm^3", value_reported_unit=mean,
                                         value_canonical=mean*1000, unit_canonical="kg/m^3",
                                         conversion_factor_to_canonical=1000, reported_or_derived="reported",
                                         statistic_type="mean", uncertainty_type="standard_deviation",
                                         uncertainty_value_reported=sd, uncertainty_value_canonical=sd*1000,
                                         sample_size_n=3, replicate_type="independent technical replicates",
                                         density_basis="sink_float_density_not_verified_outer_area_bulk_density",
                                         density_method_qualification="General GF density method in SI p.7; no separate GOF protocol specified.",
                                         extraction_method="vector_path_calibrated_diamond_and_error_caps",
                                         marker_path_index=marker, marker_center_pdf_pt=[x,y],
                                         error_cap_path_indices=list(error_ids), error_cap_y_pdf_pt=caps,
                                         digitization_sensitivity_reported_unit=sensitivity,
                                         digitization_sensitivity_sd_reported_unit=sensitivity,
                                         digitization_sensitivity_definition="Half PDF point plus maximum tick-fit residual; not experimental uncertainty.",
                                         resolution_limited_sd=False, status="admission_ready_figure_digitized")))
    clip = pymupdf.Rect(115,140,485,490)
    raw = qa / "fig36_source.png"
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2,2), clip=clip)
    pix.save(raw)
    im = Image.open(raw).convert("RGB")
    draw_image = ImageDraw.Draw(im)
    for row in records:
        x, y = row["density"]["marker_center_pdf_pt"]
        x, y = 2*(x-clip.x0), 2*(y-clip.y0)
        draw_image.line((x-8,y,x+8,y),fill=(0,155,0),width=2)
        draw_image.line((x,y-8,x,y+8),fill=(0,155,0),width=2)
    marked = qa / "fig36_calibration.png"
    im.save(marked)
    return dict(pdf_page=43, printed_page=42, figure="36", calibration=dict(x=xcal,density=ycal),
                records=records, visual_crop=dict(source_crop=str(raw),calibrated_crop=str(marked),
                                                 source_crop_sha256=sha(raw), calibrated_crop_sha256=sha(marked)))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--qa-dir", type=Path, default=Path(tempfile.gettempdir())/"liu_omitted_figures")
    parser.add_argument("--crops-reviewed", action="store_true", help="Set only after inspecting the generated source/overlay crops.")
    args = parser.parse_args()
    qa = args.qa_dir.resolve()
    # Keep all raster inspection artifacts outside the project deliverable tree.
    assert ROOT not in qa.parents and qa != ROOT
    qa.mkdir(parents=True, exist_ok=True)
    assert sha(PDF) == EXPECTED_SI and sha(MAIN) == EXPECTED_MAIN
    packet_path = ROOT / "data/curation/primary_additions/liu_2026.json"
    packet = json.loads(packet_path.read_text())
    with pymupdf.open(PDF) as doc:
        raman = extract_raman(doc, qa, packet)
        thermal = extract_thermal(doc, qa)
        precursor = extract_precursor(doc, qa)
    assert len(raman["records"]) == 6 and len(thermal["records"]) == 4 and len(precursor["records"]) == 5
    assert len({r["curated_state_id"] for section in [raman,thermal,precursor] for r in section["records"]}) == 15
    result = dict(schema_version="cpt-source-figure-extraction-v1", doi=DOI, audit_date="2026-10-22",
                  status="source_extracted_crops_reviewed_pending_parent_admission" if args.crops_reviewed else "source_extracted_pending_crop_review",
                  review_status="ai_source_checked_not_human_adjudicated", curator="CPT AI-assisted source audit",
                  production_database_modified=False, script=str(Path(__file__).resolve()), script_sha256=sha(Path(__file__)),
                  sources=dict(si=dict(path=str(PDF),sha256=EXPECTED_SI,url=BASE_URL+PDF.name),
                               main=dict(path=str(MAIN),sha256=EXPECTED_MAIN,url=f"https://www.nature.com/articles/{DOI.split('/')[1]}")),
                  state_id_lookup_packet=dict(path=str(packet_path),sha256=sha(packet_path),read_only=True),
                  conventions=dict(specimen_linkage="single_source_row_unverified",
                                   review="AI source check only; no human approval claimed",
                                   raster="Native embedded RGB strips concatenated without resampling. Native pixels are the quantitative coordinate system; per-strip maps locate points on the PDF.",
                                   sensitivity="Coordinate envelopes and reciprocal sensitivity are not SD, SE, confidence intervals or measured variability.",
                                   uncertainty="Only Figs.38/36 have source-reported SD and n=3; no SD or n assigned to Raman."),
                  admission_decision_history=[
                      dict(stage="provisional", decision="Thermal endpoint densities considered for source-alternative-only retention to avoid potential duplicate populations."),
                      dict(stage="final", decision="Retain all four Fig.38e diameter-density measurement sets; withholding endpoints creates artificial missingness. Record possible overlap without declaring reused or independent specimens.")],
                  raman_drawing=raman, thermal_summary=thermal, precursor_density=precursor,
                  checks=dict(expected_source_hashes=True, tick_calibration_residual_below_1_5_pixels_or_points=True,
                              drawing_x_labels_match=True, positive_reciprocal_intervals=True,
                              separate_thermal_and_precursor_states=True, no_gauge_value_borrowing=True,
                              thermal_endpoint_overlap_explicit_and_not_counted_independent=True,
                              Raman_reciprocals_independent_two_tick_check_within_sensitivity=True,
                              rendered_crops_visually_reviewed=args.crops_reviewed))
    OUTPUT.write_text(json.dumps(result,indent=2,allow_nan=False)+"\n")
    print(json.dumps(dict(output=str(OUTPUT),qa_directory=str(qa),
                          raman=[dict(draw=r["draw_ratio"],d_g=r["raw_d_g"]["value_reported_unit"],
                                      g_d=r["g_d"]["value_canonical"],sensitivity=r["g_d"]["digitization_sensitivity_interval"]) for r in raman["records"]],
                          thermal=[dict(state=r["source_state_label"],
                                        diameter_um=r["measurements"]["diameter"]["value_reported_unit"],
                                        diameter_sd=r["measurements"]["diameter"]["uncertainty_value_reported"],
                                        rho_g_cm3=r["measurements"]["density"]["value_reported_unit"],
                                        rho_sd=r["measurements"]["density"]["uncertainty_value_reported"]) for r in thermal["records"]],
                          precursor=[dict(draw=r["draw_ratio"],rho=r["density"]["value_reported_unit"],
                                          sd=r["density"]["uncertainty_value_reported"]) for r in precursor["records"]]),indent=2))


if __name__ == "__main__":
    main()
