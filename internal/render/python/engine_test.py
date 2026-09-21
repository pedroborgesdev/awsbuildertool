import hashlib
import base64
import contextlib
import io
import json
import os
import random
from pathlib import Path
import tempfile
import unittest
from PIL import Image
from engine import Page, FORMATS, COLORS, icon_mask, render_campaign, render_page, render_decorative_branches, normalize, wrap, font_path, face, overlap, campaign_style, candidate_specs, block_options


def campaign(platform="instagram-square", seed=424242):
    roles=["cover","list","flow","comparison","manifesto","cta"]
    pages=[]
    for i,role in enumerate(roles):
        items=[] if role in ("cover","manifesto","cta") else [
            {"title":"Start small","text":"Define a hypothesis and the expected result.","iconIntent":"terminal"},
            {"title":"Validate delivery","text":"Test, observe, and document the learning.","iconIntent":"database"},
        ]
        pages.append({"role":role,"eyebrow":"Kubernetes + AWS","title":["From concept to practice","Cluster pieces","From commit to delivery","Choose with context","Build. Test. Learn.","Your next step"][i],
                  "body":"Learn from short examples and move forward safely." if not items else "", "items":items,
                  "cta":"Save and put it into practice" if i in (0,5) else "", "iconIntent":["terminal","cloud","git-branch","shield","chat","share"][i]})
    return {"version":1,"layoutSeed":seed,"brief":{"platform":platform,"postCount":6},"pages":pages}


class EngineTests(unittest.TestCase):
    design=Path(__file__).resolve().parents[3]/"design_system"

    def test_complete_pixel_icon_catalog(self):
        expected={"audio","bell","bookmark","brackets","bug","calendar","chat","chip","cloud","community",
                  "connector","database","droplet","git-branch","globe","hashtag","heart","key","lightning",
                  "mail","package","play-target","robot","server","share","shield","signal","terminal","trophy","user"}
        catalog={path.stem: str(path.relative_to(self.design)) for path in (self.design/"icon_sources").rglob("*.svg")}
        catalog.update({alias: catalog[target] for alias,target in {
            "audio":"audio-waveform", "brackets":"code", "chat":"message", "chip":"cpu", "community":"users",
            "connector":"link", "droplet":"circle", "hashtag":"hash", "lightning":"zap",
            "play-target":"target"}.items() if target in catalog})
        self.assertTrue(expected.issubset(catalog))
        self.assertGreaterEqual(len(catalog),191)
        for name,relative in catalog.items():
            with self.subTest(name=name):
                self.assertTrue(relative.startswith("icon_sources/pixelarticons/"))
                path=self.design/relative
                self.assertTrue(path.is_file(),path)
                self.assertEqual(path.suffix,".svg")
                svg=path.read_text(encoding="utf-8")
                self.assertIn('fill="currentColor"',svg)
        for name in expected:
            with self.subTest(raster=name):
                alpha=icon_mask(str(self.design),name)
                self.assertIsNotNone(alpha.getbbox())
                self.assertEqual(alpha.size,(96,96))

        self.assertEqual(len(list((self.design/"icon_sources"/"pixelarticons").glob("*.svg"))),191)
        self.assertFalse((self.design/"icon_cache").exists())

    def test_every_format_and_algorithmic_layout_obeys_geometry(self):
        snapshots=os.environ.get("STUDIO_SNAPSHOT_DIR")
        with tempfile.TemporaryDirectory() as temp:
            for platform,size in FORMATS.items():
                with self.subTest(platform=platform):
                    snapshot_format=platform in ("instagram-square","instagram-portrait","instagram-story","x-landscape")
                    target=Path(snapshots if snapshots and snapshot_format else temp)/platform
                    with contextlib.redirect_stdout(io.StringIO()):
                        report=render_campaign(campaign(platform),target,self.design)
                    self.assertEqual(len(report["files"]),8)
                    self.assertEqual(len(report["pages"]),6)
                    self.assertIn(report["colorSystem"]["mode"],("mono","spectrum"))
                    for page_index,page in enumerate(report["pages"]):
                        self.assertEqual((page["width"],page["height"]),size)
                        self.assertEqual(page["layoutEngine"],"algorithmic-grid")
                        self.assertEqual(len(page["candidateLayouts"]),3)
                        self.assertIn(page["selectedLayout"],page["candidateLayouts"])
                        self.assertTrue(all(name.startswith("pack-") for name in page["candidateLayouts"]))
                        self.assertTrue(page["blockAllocations"])
                        heading=next(block for block in page["blockAllocations"] if block["type"]=="title")
                        top_level=[block for block in page["blockAllocations"] if "listPattern" not in block]
                        content_blocks=[block for block in top_level if block["type"]!="title"]
                        separation=page["componentGap"]
                        self.assertEqual(page["titlePosition"],"top")
                        self.assertTrue(all(block["row"]>=heading["row"]+heading["rows"]+separation for block in content_blocks))
                        if page["componentGap"]:
                            for position,a in enumerate(top_level):
                                a_cells={(x,y) for y in range(a["row"],a["row"]+a["rows"])
                                         for x in range(a["column"],a["column"]+a["columns"])}
                                a_margin={neighbor for cell in a_cells for neighbor in
                                          ((cell[0]-1,cell[1]),(cell[0]+1,cell[1]),(cell[0],cell[1]-1),(cell[0],cell[1]+1))}
                                for b in top_level[position+1:]:
                                    b_cells={(x,y) for y in range(b["row"],b["row"]+b["rows"])
                                             for x in range(b["column"],b["column"]+b["columns"])}
                                    self.assertFalse(a_margin & b_cells)
                        for block in page["blockAllocations"]:
                            region=page["regions"][block["name"]]["box"]
                            self.assertEqual(region[2]-region[0],block["columns"]*page["module"])
                            self.assertEqual(region[3]-region[1],block["rows"]*page["module"])
                        branches=page["decorativeBranches"]
                        self.assertGreaterEqual(len(branches),2)
                        self.assertLessEqual(len(branches),32)
                        clusters={branch["cluster"] for branch in branches}
                        self.assertLessEqual(len(clusters),4)
                        for cluster_id in clusters:
                            cluster=sorted((branch for branch in branches if branch["cluster"]==cluster_id),key=lambda branch:branch["step"])
                            self.assertGreaterEqual(len(cluster),2)
                            visited=set()
                            for branch in cluster:
                                cell=(branch["column"],branch["row"])
                                if visited:
                                    self.assertTrue(any(abs(cell[0]-old[0])+abs(cell[1]-old[1])==1 for old in visited))
                                visited.add(cell)
                            gradients=[branch["color"] for branch in cluster if branch["type"]=="gradient"]
                            if gradients:
                                self.assertEqual(len(set(gradients)),1)
                                bounds={json.dumps(branch["gradientBounds"],sort_keys=True) for branch in cluster}
                                self.assertEqual(len(bounds),1)
                            for branch in cluster[1:]:
                                parent=branch["parent"]
                                self.assertIsNotNone(parent)
                                self.assertIn((parent["column"],parent["row"]),visited)
                        self.assertGreater(len(page["gridY"]),5)
                        self.assertTrue(page["squares"])
                        for box in page["squares"]: self.assertEqual(box[2]-box[0],box[3]-box[1])
                        self.assertIn("brand",page["regions"])
                        for text in page["texts"]:
                            box,bounds=text["box"],text["bounds"]
                            self.assertGreaterEqual(bounds[0],box[0]); self.assertGreaterEqual(bounds[1],box[1])
                            self.assertLessEqual(bounds[2],box[2]); self.assertLessEqual(bounds[3],box[3])
                        regions=list(page["regions"].values())
                        for i,a in enumerate(regions):
                            for b in regions[i+1:]:
                                if a["parent"]==b["parent"]: self.assertFalse(overlap(a["box"],b["box"]))
                        for name,region in page["regions"].items():
                            if region["kind"]=="region" and name!="canvas":
                                x1,y1,x2,y2=region["box"]
                                self.assertEqual(x1%page["module"],0,name)
                                self.assertEqual(x2%page["module"],0,name)
                                self.assertEqual(y1%page["module"],0,name)
                                self.assertTrue(y2%page["module"]==0 or y2==page["height"],name)
                        icon_assets=[name for name,region in page["regions"].items() if region["kind"]=="asset" and "icon" in name]
                        self.assertGreaterEqual(len(icon_assets),1)
                        expected_items=len(campaign(platform)["pages"][page_index]["items"])
                        semantic_item_icons=[name for name in icon_assets
                                             if name.startswith("item-") or name.startswith("component-comparison-icon-")
                                             or name.startswith("component-flow-icon-")]
                        self.assertEqual(len(semantic_item_icons),expected_items)
                        self.assertNotIn("eyebrow",page["regions"])
                        self.assertIn("eyebrow-label",page["regions"])
                        if report["colorSystem"]["mode"]=="mono":
                            self.assertEqual(len(set(page["itemColors"])),1)
                            self.assertEqual(page["itemColors"][0],report["colorSystem"]["accent"])
                            for branch in page["decorativeBranches"]:
                                expected=report["colorSystem"]["accent"] if branch["type"]=="solid" else report["colorSystem"]["accent"]+"-to-white"
                                self.assertEqual(branch["color"],expected)
                        else:
                            self.assertGreater(len(set(page["itemColors"])),3)

    def test_visual_component_roles_render_as_real_components(self):
        visual_roles={
            "diagram":[0,0,0],
            "chart":[45,35,20],
            "timeline":[0,0,0],
            "stats":[12,4,87],
            "comparison":[0,0],
        }
        with tempfile.TemporaryDirectory() as temp:
            for role,values in visual_roles.items():
                with self.subTest(role=role):
                    content={"role":role,"eyebrow":"Overview","title":"A visual component",
                             "body":"","cta":"","iconIntent":"chart","items":[
                                 {"title":title,"text":"Short explanation.","iconIntent":icon,"value":value}
                                 for title,icon,value in zip(("Descobrir","Construir","Medir"),("search","brackets","signal"),values)]}
                    page=render_page(content,0,1,FORMATS["instagram-square"],self.design,8127)
                    self.assertIn(f"component-{role}",page.regions)
                    self.assertEqual(page.regions[f"component-{role}"]["kind"],"region")
                    self.assertGreater(page.layout_score,0)
                    self.assertTrue(any(name.startswith(f"component-{role}-") for name in page.regions))

    def test_candidate_pool_supports_both_icon_treatments(self):
        content=campaign()["pages"][1]
        specs,_=candidate_specs(content,FORMATS["instagram-square"],9191,campaign_style(9191))
        treatments={spec["iconTreatment"] for spec in specs}
        self.assertEqual(treatments,{"color-block","color-icon"})
        self.assertEqual({spec["chartType"] for spec in specs},{"pie","bar"})

    def test_chart_can_render_pie_and_equal_width_columns(self):
        content={"role":"chart","eyebrow":"Distribution","title":"Where effort goes","body":"","cta":"",
                 "iconIntent":"chart","items":[
                     {"title":"Planejar","text":"","iconIntent":"calendar","value":45},
                     {"title":"Construir","text":"","iconIntent":"brackets","value":35},
                     {"title":"Medir","text":"","iconIntent":"signal","value":20}]}
        pie=render_page(content,0,1,(1080,1080),self.design,1)
        bars=render_page(content,0,1,(1080,1080),self.design,3)
        self.assertEqual(pie.component_rules[0]["component"],"pie-chart")
        self.assertEqual(bars.component_rules[0]["component"],"bar-chart")
        self.assertTrue(bars.component_rules[0]["commonBaseline"])
        self.assertTrue(bars.component_rules[0]["equalWidths"])

    def test_component_description_is_attached_and_title_is_always_above(self):
        cases={
            "list":[{"title":"Primeiro","text":"Detalhe curto.","iconIntent":"key"},
                    {"title":"Segundo","text":"Outro detalhe.","iconIntent":"cloud"}],
            "chart":[{"title":"Produto","text":"","iconIntent":"package","value":60},
                     {"title":"Plataforma","text":"","iconIntent":"server","value":40}],
                "flow":[{"title":"Plan","text":"Define the goal.","iconIntent":"calendar"},
                    {"title":"Deliver","text":"Validate the result.","iconIntent":"play-target"}],
        }
        for role,items in cases.items():
            with self.subTest(role=role):
                content={"role":role,"eyebrow":"Overview","title":"Title always comes first",
                         "body":"This explanation belongs directly to the component.","items":items,
                         "cta":"","iconIntent":"connector"}
                page=render_page(content,0,1,(1080,1350),self.design,4400+len(role))
                heading=next(block for block in page.block_allocations if block["type"]=="title")
                component=next(block for block in page.block_allocations if block["type"] in ("visual","item-group"))
                self.assertEqual(page.title_position,"top")
                self.assertGreaterEqual(component["row"],heading["row"]+heading["rows"]+page.component_gap)
                self.assertNotIn("subtitle",page.regions)
                self.assertIn("component-description-panel",page.regions)
                self.assertIn("component-description",page.regions)
                description_panel=page.regions["component-description-panel"]
                description_text=page.regions["component-description"]
                self.assertEqual(description_panel["parent"],component["name"])
                self.assertEqual(description_text["parent"],"component-description-panel")
                self.assertEqual(description_panel["box"][0],component["column"]*page.g)
                self.assertEqual(description_panel["box"][2],(component["column"]+component["columns"])*page.g)
                if role=="list":
                    first_child=page.regions["item-1"]
                    self.assertEqual(first_child["parent"],component["name"])
                    self.assertEqual(description_panel["box"][3],first_child["box"][1])
                self.assertTrue(page.component_rules[0]["descriptionAttached"])

    def test_editorial_score_diversity_and_visual_mass(self):
        content={"role":"cta","eyebrow":"Shall we build together?","title":"Now it is your turn.",
                 "body":"Want the materials? Take this conversation to your class.","items":[],
                 "cta":"Comment on AWS or contact me.","iconIntent":"community"}
        page=render_page(content,0,1,(1080,1350),self.design,624918)
        self.assertIn("visual-mass",page.regions)
        self.assertIn("visual-mass-icon",page.regions)
        self.assertNotIn("page-icon",page.regions)
        self.assertEqual(page.title_icon_mode,"none")
        self.assertEqual(len(page.candidate_scores),3)
        self.assertGreaterEqual(len({entry["layout"] for entry in page.candidate_scores}),3)
        self.assertGreaterEqual(sum(entry["distanceFromBest"]>=.15 for entry in page.candidate_scores),2)
        self.assertEqual(set(page.layout_score_breakdown),{"readingFlow","dominance","hierarchy","titleEconomy","contrast",
                         "balance","coverage","alignment","adjacency","grouping","negativeSpace",
                         "proximity","gridDiscipline","edgeUse","listRhythm","componentRules",
                         "decoration","colorRhythm"})
        self.assertTrue(all(0<=value<=1 for value in page.layout_score_breakdown.values()))
        self.assertGreater(page.layout_score,65)

    def test_decorative_cluster_can_form_a_real_fork(self):
        # A spacious grid makes the brancher exercise its tree path instead of
        # merely proving that a two-cell connected pair can be drawn.
        forks=[]; solid_without_border=False; continuous_gradient=False
        for seed in range(32):
            p=Page(1080,1080,True,self.design,1)
            p.reserve("content",(0,p.g,p.w,p.h-p.g))
            cols=p.w//p.g; rows=(p.h-2*p.g)//p.g
            records=render_decorative_branches(p,{"accent":"pink","gradient":"pink-to-white"},{(cols//2,rows//2)},cols,rows,random.Random(seed))
            for cluster_id in {record["cluster"] for record in records}:
                cluster=[record for record in records if record["cluster"]==cluster_id]
                cells={(record["column"],record["row"]) for record in cluster}
                forks.extend(cell for cell in cells if sum(neighbor in cells for neighbor in ((cell[0]-1,cell[1]),(cell[0]+1,cell[1]),(cell[0],cell[1]-1),(cell[0],cell[1]+1)))>=3)
                for record in cluster:
                    px=(record["column"]*p.g,p.g+record["row"]*p.g)
                    if record["type"]=="solid":
                        expected=tuple(bytes.fromhex(COLORS[record["color"]][1:]))
                        solid_without_border |= p.image.getpixel(px)==expected
                if cluster[0]["type"]=="gradient":
                    by_cell={(record["column"],record["row"]):record for record in cluster}
                    for cell in by_cell:
                        for neighbor in ((cell[0]+1,cell[1]),(cell[0],cell[1]+1)):
                            if neighbor not in by_cell: continue
                            box_a=(cell[0]*p.g,p.g+cell[1]*p.g,(cell[0]+1)*p.g,p.g+(cell[1]+1)*p.g)
                            box_b=(neighbor[0]*p.g,p.g+neighbor[1]*p.g,(neighbor[0]+1)*p.g,p.g+(neighbor[1]+1)*p.g)
                            continuous_gradient |= p.image.crop(box_a).tobytes()!=p.image.crop(box_b).tobytes()
        self.assertTrue(forks, "expected at least one T/Y-shaped decorative fork")
        self.assertTrue(solid_without_border,"solid branch should paint over grid dividers")
        self.assertTrue(continuous_gradient,"adjacent cells should sample different parts of one cluster gradient")

    def test_grid_has_horizontal_lines_and_square_cells(self):
        p=Page(1080,1080,True,self.design,1)
        self.assertEqual(p.g,120)
        self.assertEqual(p.grid_x,p.grid_y)
        self.assertEqual(p.image.getpixel((p.g//2,p.g)),(43,53,66))
        self.assertNotEqual(p.image.getpixel((p.g//2,p.g//2)),p.image.getpixel((p.g//2,p.g)))

    def test_coarse_grid_uses_nine_primary_columns(self):
        expected={(1080,1080):(120,9),(1080,1350):(120,9),(1080,1920):(120,9),
                  (1200,1500):(120,10),(1600,900):(100,16)}
        for size,(module,columns) in expected.items():
            with self.subTest(size=size):
                p=Page(*size,True,self.design,1)
                self.assertEqual(p.g,module)
                self.assertEqual(p.w//p.g,columns)

    def test_unicode_normalization_fallback_and_long_word_wrap(self):
        text=normalize("Make sure: action, cafe, join, and step-by-step")
        self.assertNotIn("\u2011",text)
        f=face(font_path(text),24)
        wrapped=wrap("https://example.com/"+"a"*120,f,170)
        self.assertGreater(len(wrapped.splitlines()),5)
        for line in wrapped.splitlines(): self.assertLessEqual(f.getlength(line),170)
        with self.assertRaisesRegex(ValueError,"glifo"):
            font_path("\U0010FFFF")

    def test_overflow_and_collisions_fail_before_export(self):
        p=Page(1080,1080,True,self.design,1)
        p.panel("a",(0,0,100,100))
        with self.assertRaisesRegex(ValueError,"collision"): p.panel("b",(50,50,150,150))
        with self.assertRaisesRegex(ValueError,"fora"): p.reserve("outside",(0,0,200,200),"a")
        with self.assertRaisesRegex(ValueError,"does not fit"):
            p.text("too-long","too much text "*100,(10,10,90,90),"a",24,22)
        with tempfile.TemporaryDirectory() as temp:
            draft=campaign(); draft["pages"][-1]["body"]="text "*3000
            output=Path(temp)/"output"
            with self.assertRaises(ValueError): render_campaign(draft,output,self.design)
            self.assertFalse(output.exists())

    def test_same_content_has_identical_pixels(self):
        draft=campaign()
        first=render_page(draft["pages"][0],0,6,(1080,1080),self.design,draft["layoutSeed"])
        second=render_page(draft["pages"][0],0,6,(1080,1080),self.design,draft["layoutSeed"])
        self.assertEqual(hashlib.sha256(first.image.tobytes()).digest(),hashlib.sha256(second.image.tobytes()).digest())
        varied=render_page(draft["pages"][0],0,6,(1080,1080),self.design,draft["layoutSeed"]+1)
        self.assertNotEqual(first.selection_seed,varied.selection_seed)
        self.assertNotEqual(first.block_allocations,varied.block_allocations)

    def test_campaign_color_modes_are_intentional(self):
        self.assertEqual(campaign_style(1),{"mode":"mono","accent":"purple"})
        self.assertEqual(campaign_style(999,"green"),{"mode":"mono","accent":"green"})
        self.assertEqual(campaign_style(999,"colorful")["mode"],"spectrum")
        mono,_=candidate_specs({},(1080,1080),91,campaign_style(1))
        self.assertTrue(all(spec["accent"]=="purple" and len(set(spec["itemColors"]))==1 and spec["gradient"]=="purple-to-white" for spec in mono))
        spectrum,_=candidate_specs({},(1080,1080),91,campaign_style(0))
        self.assertTrue(all(len(set(spec["itemColors"]))==5 and spec["gradient"] in ("pink-to-orange","lavender-to-lime","purple-blue-diagonal","purple-pink-orange") for spec in spectrum))

    def test_page_theme_can_be_dark_light_or_both(self):
        style=campaign_style(9191,"blue")
        dark,_=candidate_specs({},(1080,1080),9191,style,"dark")
        light,_=candidate_specs({},(1080,1080),9191,style,"light")
        both,_=candidate_specs({},(1080,1080),9191,style,"both")
        self.assertTrue(all(spec["dark"] for spec in dark))
        self.assertTrue(all(not spec["dark"] for spec in light))
        self.assertEqual({spec["dark"] for spec in both},{False,True})

        draft=campaign("instagram-square",9292)
        draft["brief"]["pageTheme"]="both"
        with tempfile.TemporaryDirectory() as temp, contextlib.redirect_stdout(io.StringIO()):
            report=render_campaign(draft,Path(temp)/"campaign",self.design)
        self.assertEqual(report["pageTheme"],"both")
        self.assertEqual({page["pageTheme"] for page in report["pages"]},{"dark","light"})

    def test_about_profile_and_selected_theme_reach_the_footer(self):
        draft=campaign("instagram-square",8080)
        photo=Image.new("RGB",(1080,1080),"#42B4FF")
        encoded=io.BytesIO(); photo.save(encoded,"JPEG",quality=90)
        draft["brief"].update({"useAboutFooter":True,"aboutName":"Pedro Borges",
                               "aboutSubtitle":"Cloud Engineer","aboutPhoto":"data:image/jpeg;base64,"+base64.b64encode(encoded.getvalue()).decode()})
        draft["brief"]["colorTheme"]="orange"
        with tempfile.TemporaryDirectory() as temp:
            report=render_campaign(draft,Path(temp)/"campaign",self.design)
        self.assertEqual(report["colorSystem"],{"mode":"mono","accent":"orange"})
        for page in report["pages"]:
            name=next(text for text in page["texts"] if text["name"]=="footer-about-name")
            self.assertEqual(name["text"],"Pedro Borges")
            self.assertEqual(name["color"],COLORS["orange"])
            self.assertIn("footer-about-subtitle",page["regions"])
            self.assertIn("footer-photo",page["regions"])
            self.assertIn("footer-aws-logo",page["regions"])
            counter=page["regions"]["page-number"]["box"]
            logo=page["regions"]["footer-aws-logo"]["box"]
            self.assertAlmostEqual((counter[0]+counter[2])/2,page["width"]/2,delta=2)
            self.assertGreater(logo[0],counter[2])
            self.assertGreaterEqual(next(text for text in page["texts"] if text["name"]=="page-number")["size"],13)

    def test_footer_without_about_places_logo_left_and_counter_right(self):
        draft=campaign("instagram-square",8181)
        draft["brief"]["useAboutFooter"]=False
        with tempfile.TemporaryDirectory() as temp:
            report=render_campaign(draft,Path(temp)/"campaign",self.design)
        for page in report["pages"]:
            self.assertNotIn("footer-photo",page["regions"])
            self.assertNotIn("footer-about-name",page["regions"])
            logo=page["regions"]["footer-aws-logo"]["box"]
            counter=page["regions"]["page-number"]["box"]
            self.assertLess(logo[0],page["width"]/2)
            self.assertGreater(counter[0],page["width"]/2)
            self.assertLess(page["width"]-counter[2],page["width"]*.03)

    def test_five_items_and_cta_regression(self):
        page={"role":"list","eyebrow":"AWS Builder Center","title":"Benefits for students and professionals","body":"",
              "items":[{"title":title,"text":text,"iconIntent":icon} for title,text,icon in [
                  ("Learn","Step-by-step tutorials with real code.","brackets"),
                  ("Practice","Ready-to-use lab environments.","play-target"),
                  ("Collaborate","An active community for questions and feedback.","community"),
                  ("Certify yourself","Community badges and projects.","trophy"),
                  ("Innovate","Challenges to grow your skills.","lightning")]],
              "cta":"Join Builder Center","iconIntent":"community"}
        for size in ((1080,1080),(1080,1350),(1080,1920),(1600,900)):
            with self.subTest(size=size):
                result=render_page(page,0,1,size,self.design)
                self.assertFalse(overlap(result.regions["item-5"]["box"],result.regions["cta"]["box"]))
                self.assertEqual(len([text for text in result.texts if text["name"].startswith("item-") and text["name"].endswith(("-title","-text"))]),10)
                self.assertEqual(len(result.candidate_layouts),3)

    def test_list_items_keep_aligned_semantic_patterns(self):
        allowed_by_count={
            1:{"single-1x1"},
            2:{"aligned-1x2","grid-2x1","stair-right","stair-left"},
            3:{"aligned-1x3"},
            4:{"grid-2x2","aligned-1x4","stair-right","stair-left"},
            5:{"aligned-1x5","grid-2x2-left","stair-right","stair-left"},
            6:{"grid-2x3"},
            7:{"grid-2x3-left"},
            8:{"grid-2x4"},
            9:{"grid-3x3"},
        }
        for count,allowed in allowed_by_count.items():
            with self.subTest(count=count):
                page={"role":"list","eyebrow":"AWS","title":"Pontos principais","body":"",
                      "items":[{"title":f"Item {i+1}","text":"Short explanation.","iconIntent":"brackets"} for i in range(count)],
                      "cta":"","iconIntent":"brackets"}
                result=render_page(page,0,1,(1080,1350),self.design,700+count)
                allocations=[block for block in result.block_allocations if block["type"]=="item"]
                self.assertEqual(len(allocations),count)
                patterns={block["listPattern"] for block in allocations}
                self.assertEqual(len(patterns),1)
                self.assertTrue(patterns.issubset(allowed))
                self.assertEqual(len({(block["columns"],block["rows"]) for block in allocations}),1)
                self.assertTrue({block["rows"] for block in allocations}.issubset({1,2}))
                pattern=next(iter(patterns))
                ordered=sorted(allocations,key=lambda block:block["row"])
                if pattern.startswith("aligned"):
                    self.assertEqual(len({block["column"] for block in allocations}),1)
                    self.assertEqual([b["row"]-a["row"] for a,b in zip(ordered,ordered[1:])],
                                     [a["rows"] for a,b in zip(ordered,ordered[1:])])
                if pattern=="grid-2x2":
                    self.assertEqual(len({block["column"] for block in allocations}),2)
                    self.assertEqual(len({block["row"] for block in allocations}),2)
                    self.assertEqual(max(block["column"] for block in allocations)-min(block["column"] for block in allocations),allocations[0]["columns"])
                    self.assertEqual(max(block["row"] for block in allocations)-min(block["row"] for block in allocations),allocations[0]["rows"])
                if pattern=="grid-2x2-left":
                    bottom=max(block["row"] for block in allocations)
                    self.assertEqual(len([block for block in allocations if block["row"]==bottom]),1)
                    self.assertEqual([block for block in allocations if block["row"]==bottom][0]["column"],min(block["column"] for block in allocations))
                if pattern.startswith("stair"):
                    step=1 if pattern=="stair-right" else -1
                    self.assertEqual([b["column"]-a["column"] for a,b in zip(ordered,ordered[1:])],[step]*(count-1))
                    self.assertEqual([b["row"]-a["row"] for a,b in zip(ordered,ordered[1:])],
                                     [a["rows"] for a,b in zip(ordered,ordered[1:])])

    def test_list_width_is_measured_across_the_available_grid(self):
        p=Page(1080,1350,False,self.design,1,"blue")
        content={"role":"list","eyebrow":"AWS","title":"Title","body":"",
                 "items":[{"title":f"Item {i}","text":"Short text.","iconIntent":"brackets"} for i in range(3)],
                 "cta":"","iconIntent":"brackets"}
        blocks=block_options(p,content,9,8,{"wrapBias":0},random.Random(10))
        group=next(block for block in blocks if block["kind"]=="item-group")
        widths={meta["tileWidth"] for _,_,meta in group["options"] if meta["pattern"]=="aligned-1x3"}
        self.assertGreater(len(widths),3)
        self.assertEqual(max(widths),9)

    def test_cta_typography_and_icon_visual_scale_are_larger(self):
        base={"eyebrow":"","title":"Start now","body":"Turn the idea into a next action.",
              "items":[],"cta":"","iconIntent":"lightning"}
        regular=render_page({**base,"role":"manifesto"},0,1,(1080,1080),self.design,2026)
        cta=render_page({**base,"role":"cta"},0,1,(1080,1080),self.design,2026)
        regular_sizes={text["name"]:text["size"] for text in regular.texts}
        cta_sizes={text["name"]:text["size"] for text in cta.texts}
        self.assertGreater(cta_sizes["title"],regular_sizes["title"])
        self.assertGreater(cta_sizes["subtitle-text"],regular_sizes["subtitle-text"])

        p=Page(1080,1080,False,self.design,1,"blue")
        parent=p.panel("icon-parent",(0,0,180,180))
        p.icon("large-icon","shield",(0,0,180,180),"icon-parent","ink")
        crop=p.image.crop((0,0,180,180))
        pixels=crop.load(); ink=tuple(int(COLORS["ink"][i:i+2],16) for i in (1,3,5))
        points=[(x,y) for y in range(180) for x in range(180) if pixels[x,y]==ink]
        self.assertGreater(max(x for x,_ in points)-min(x for x,_ in points),130)


if __name__=="__main__": unittest.main()
