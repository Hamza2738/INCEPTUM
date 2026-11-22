"""Simple profitability workbook (.xlsx) for farmers who are not used to spreadsheets.

Yellow cells are the farmer's own numbers; every result is a live Excel formula, so changing a yellow
cell updates the whole workbook. Formulas use defined names (area, price, ...) so they work whatever
the sheet names are in the farmer's language.
"""
import datetime as dt
import io

import xlsxwriter
from xlsxwriter.utility import xl_col_to_name

YEARS_MAX = 40
LEDGER_ROWS = 300

INK = "#101C3A"
MUTED = "#566079"
GREEN = "#0F6E6A"
GREEN_SOFT = "#E3F2EF"
RED_SOFT = "#FBE7E7"
YELLOW = "#FFF4C2"
HEAD = "#0E1B3D"
LINE = "#D5DAE3"

T = {
    "fr": {
        "s_main": "Mon bilan", "s_years": "Année par année", "s_spend": "Mes dépenses", "s_sales": "Mes ventes", "s_help": "Mode d'emploi",
        "title": "Bilan de rentabilité", "made": "Préparé le {d} pour {who}", "crop": "Culture", "plot": "Parcelle",
        "h_inputs": "1. Vos chiffres : changez seulement les cases jaunes",
        "area": "Surface cultivée", "yield": "Récolte attendue par hectare", "factor": "Part de la récolte gardée (sel, manque d'eau)",
        "price": "Prix de vente d'un kilo", "cost_ha": "Dépenses par hectare (semences, engrais, main-d'œuvre, traitements)",
        "water": "Eau et électricité par an", "fixed": "Autres frais fixes par an (location, assurance…)",
        "invest": "Achat de matériel ou plantation (une seule fois)", "years": "Sur combien d'années ?", "ramp": "Années avant la pleine récolte (arbres)",
        "u_ha": "ha", "u_kgha": "kg / ha", "u_pct": "%", "u_kg": "kg", "u_years": "ans",
        "h_result": "2. Le résultat d'une année normale",
        "prod": "Récolte totale", "money_in": "Argent qui rentre (ventes)", "money_out": "Argent qui sort (dépenses)", "depr": "Part du matériel à mettre de côté chaque année",
        "profit": "Ce qui vous reste par an", "ok": "✅ Rentable : vous gagnez de l'argent", "ko": "❌ Pas rentable : vous perdez de l'argent",
        "min_price": "Prix minimum de vente (en dessous, vous perdez)", "min_yield": "Récolte minimum par hectare (en dessous, vous perdez)",
        "h_scen": "3. Et si l'année est mauvaise ou bonne ?", "bad": "Mauvaise année (prix −20 %, récolte −15 %)", "normal": "Année normale", "good": "Bonne année (prix +20 %, récolte +10 %)",
        "h_risk": "4. Le risque calculé par l'application ({n} simulations)", "p_loss": "Risque de perdre de l'argent sur une année", "range": "Dans 8 années sur 10, ce qui vous reste est entre",
        "and": "et", "risk_note": "Ces valeurs ne changent pas quand vous modifiez les cases jaunes : refaites la simulation dans l'application.",
        "h_real": "5. Prévu ou réel ? Comparez avec vos carnets", "real_sales": "Ventes", "real_spend": "Dépenses", "real_left": "Ce qui reste (ventes − dépenses)", "planned": "Prévu", "real": "Réel (mes carnets)", "empty_sales": "À remplir dans « Mes ventes »", "empty_spend": "À remplir dans « Mes dépenses »",
        "y_year": "Année", "y_in": "Argent qui rentre", "y_out": "Argent qui sort", "y_flow": "Reste de l'année", "y_cum": "Total depuis le début",
        "y_note": "L'année 0 correspond à l'achat du matériel ou à la plantation. Quand le total devient positif, l'achat est remboursé.",
        "y_back": "Remboursé en année", "y_never": "Pas encore remboursé",
        "l_date": "Date", "l_cat": "Type de dépense", "l_desc": "Détail", "l_amount": "Montant", "l_total": "Total",
        "cats": ["Semences / plants", "Engrais", "Eau / électricité", "Main-d'œuvre", "Traitements", "Transport", "Matériel / réparation", "Autre"],
        "v_buyer": "Acheteur / marché", "v_kg": "Kilos vendus", "v_price": "Prix d'un kilo",
        "help": [
            "Comment utiliser ce fichier",
            "1. Ouvrez la feuille « Mon bilan ». Changez seulement les cases jaunes avec vos vrais chiffres.",
            "2. Tous les autres chiffres se recalculent tout seuls. Ne tapez rien dans les cases blanches.",
            "3. Pendant la saison, notez chaque dépense dans « Mes dépenses » et chaque vente dans « Mes ventes ».",
            "4. Regardez la partie 5 de « Mon bilan » : elle compare vos vraies ventes et vos vraies dépenses.",
            "5. « Année par année » montre quand votre achat de matériel ou votre plantation est remboursé.",
            "",
            "Petit lexique",
            "Ce qui vous reste : l'argent des ventes moins toutes les dépenses de l'année.",
            "Prix minimum de vente : si vous vendez moins cher que ce prix, vous perdez de l'argent.",
            "Récolte minimum : si vous récoltez moins que cette quantité, vous perdez de l'argent.",
            "Part de la récolte gardée : l'eau salée ou le manque d'eau font perdre une partie de la récolte.",
            "",
            "Attention : ce sont des estimations, pas une garantie. Demandez conseil à votre technicien agricole.",
        ],
    },
    "en": {
        "s_main": "My summary", "s_years": "Year by year", "s_spend": "My spending", "s_sales": "My sales", "s_help": "How to use",
        "title": "Profitability summary", "made": "Prepared on {d} for {who}", "crop": "Crop", "plot": "Plot",
        "h_inputs": "1. Your numbers: only change the yellow cells",
        "area": "Area farmed", "yield": "Expected harvest per hectare", "factor": "Share of harvest kept (salt, lack of water)",
        "price": "Selling price for one kilo", "cost_ha": "Spending per hectare (seed, fertilizer, labour, treatments)",
        "water": "Water and electricity per year", "fixed": "Other fixed costs per year (rent, insurance…)",
        "invest": "Equipment or planting (one time)", "years": "Over how many years?", "ramp": "Years before full harvest (trees)",
        "u_ha": "ha", "u_kgha": "kg / ha", "u_pct": "%", "u_kg": "kg", "u_years": "years",
        "h_result": "2. The result of a normal year",
        "prod": "Total harvest", "money_in": "Money coming in (sales)", "money_out": "Money going out (spending)", "depr": "Equipment share to set aside each year",
        "profit": "What you keep each year", "ok": "✅ Profitable: you make money", "ko": "❌ Not profitable: you lose money",
        "min_price": "Minimum selling price (below this you lose)", "min_yield": "Minimum harvest per hectare (below this you lose)",
        "h_scen": "3. What if the year is bad or good?", "bad": "Bad year (price −20%, harvest −15%)", "normal": "Normal year", "good": "Good year (price +20%, harvest +10%)",
        "h_risk": "4. Risk calculated by the app ({n} simulations)", "p_loss": "Chance of losing money in a year", "range": "In 8 years out of 10, what you keep is between",
        "and": "and", "risk_note": "These values do not change when you edit the yellow cells: run the simulation again in the app.",
        "h_real": "5. Planned or real? Compare with your notebooks", "real_sales": "Sales", "real_spend": "Spending", "real_left": "What is left (sales − spending)", "planned": "Planned", "real": "Real (my notebooks)", "empty_sales": "Fill in “My sales”", "empty_spend": "Fill in “My spending”",
        "y_year": "Year", "y_in": "Money in", "y_out": "Money out", "y_flow": "Left this year", "y_cum": "Total since the start",
        "y_note": "Year 0 is the equipment purchase or planting. When the total turns positive, the purchase is paid back.",
        "y_back": "Paid back in year", "y_never": "Not paid back yet",
        "l_date": "Date", "l_cat": "Type of spending", "l_desc": "Details", "l_amount": "Amount", "l_total": "Total",
        "cats": ["Seed / plants", "Fertilizer", "Water / electricity", "Labour", "Treatments", "Transport", "Equipment / repair", "Other"],
        "v_buyer": "Buyer / market", "v_kg": "Kilos sold", "v_price": "Price for one kilo",
        "help": [
            "How to use this file",
            "1. Open the “My summary” sheet. Only change the yellow cells, with your real numbers.",
            "2. Every other number updates by itself. Do not type in the white cells.",
            "3. During the season, write each expense in “My spending” and each sale in “My sales”.",
            "4. Look at part 5 of “My summary”: it compares your real sales and real spending.",
            "5. “Year by year” shows when your equipment or planting is paid back.",
            "",
            "Small glossary",
            "What you keep: money from sales minus all spending in the year.",
            "Minimum selling price: if you sell for less, you lose money.",
            "Minimum harvest: if you harvest less, you lose money.",
            "Share of harvest kept: salty water or lack of water costs part of the harvest.",
            "",
            "Note: these are estimates, not a guarantee. Ask your farm advisor.",
        ],
    },
    "ar": {
        "s_main": "حصيلتي", "s_years": "سنة بسنة", "s_spend": "مصاريفي", "s_sales": "مبيعاتي", "s_help": "طريقة الاستعمال",
        "title": "حصيلة المردودية", "made": "أُعدّت بتاريخ {d} لـ {who}", "crop": "الزراعة", "plot": "القطعة",
        "h_inputs": "1. أرقامك: غيّر الخانات الصفراء فقط",
        "area": "المساحة المزروعة", "yield": "المحصول المنتظر في الهكتار", "factor": "نسبة المحصول المحفوظة (الملوحة، نقص الماء)",
        "price": "سعر بيع الكيلوغرام", "cost_ha": "المصاريف في الهكتار (بذور، أسمدة، يد عاملة، معالجة)",
        "water": "الماء والكهرباء في السنة", "fixed": "مصاريف ثابتة أخرى في السنة (كراء، تأمين…)",
        "invest": "شراء معدات أو غراسة (مرة واحدة)", "years": "على كم سنة؟", "ramp": "سنوات قبل المحصول الكامل (الأشجار)",
        "u_ha": "هك", "u_kgha": "كغ / هك", "u_pct": "%", "u_kg": "كغ", "u_years": "سنة",
        "h_result": "2. نتيجة سنة عادية",
        "prod": "المحصول الجملي", "money_in": "المال الداخل (المبيعات)", "money_out": "المال الخارج (المصاريف)", "depr": "حصة المعدات التي تُدّخر كل سنة",
        "profit": "ما يبقى لك في السنة", "ok": "✅ مربح: أنت تربح المال", "ko": "❌ غير مربح: أنت تخسر المال",
        "min_price": "أدنى سعر بيع (تحته تخسر)", "min_yield": "أدنى محصول في الهكتار (تحته تخسر)",
        "h_scen": "3. وإذا كانت السنة سيئة أو جيدة؟", "bad": "سنة سيئة (السعر −20%، المحصول −15%)", "normal": "سنة عادية", "good": "سنة جيدة (السعر +20%، المحصول +10%)",
        "h_risk": "4. الخطر الذي حسبه التطبيق ({n} محاكاة)", "p_loss": "احتمال خسارة المال في سنة", "range": "في 8 سنوات من 10، ما يبقى لك بين",
        "and": "و", "risk_note": "هذه القيم لا تتغير عند تعديل الخانات الصفراء: أعد المحاكاة في التطبيق.",
        "h_real": "5. المتوقع أم الحقيقي؟ قارن مع دفاترك", "real_sales": "المبيعات", "real_spend": "المصاريف", "real_left": "ما يبقى (المبيعات − المصاريف)", "planned": "المتوقع", "real": "الحقيقي (دفاتري)", "empty_sales": "اِملأ ورقة «مبيعاتي»", "empty_spend": "اِملأ ورقة «مصاريفي»",
        "y_year": "السنة", "y_in": "المال الداخل", "y_out": "المال الخارج", "y_flow": "الباقي في السنة", "y_cum": "المجموع منذ البداية",
        "y_note": "السنة 0 هي شراء المعدات أو الغراسة. عندما يصبح المجموع موجباً، يكون الشراء قد سُدّد.",
        "y_back": "يُسدَّد في السنة", "y_never": "لم يُسدَّد بعد",
        "l_date": "التاريخ", "l_cat": "نوع المصروف", "l_desc": "التفاصيل", "l_amount": "المبلغ", "l_total": "المجموع",
        "cats": ["بذور / شتلات", "أسمدة", "ماء / كهرباء", "يد عاملة", "معالجة", "نقل", "معدات / إصلاح", "أخرى"],
        "v_buyer": "المشتري / السوق", "v_kg": "الكيلوغرامات المباعة", "v_price": "سعر الكيلوغرام",
        "help": [
            "طريقة استعمال هذا الملف",
            "1. افتح ورقة «حصيلتي». غيّر الخانات الصفراء فقط بأرقامك الحقيقية.",
            "2. كل الأرقام الأخرى تُحسب وحدها. لا تكتب في الخانات البيضاء.",
            "3. خلال الموسم، سجّل كل مصروف في «مصاريفي» وكل بيع في «مبيعاتي».",
            "4. انظر إلى الجزء 5 من «حصيلتي»: يقارن مبيعاتك ومصاريفك الحقيقية.",
            "5. ورقة «سنة بسنة» تبيّن متى يُسدَّد شراء المعدات أو الغراسة.",
            "",
            "معجم صغير",
            "ما يبقى لك: مال المبيعات ناقص كل مصاريف السنة.",
            "أدنى سعر بيع: إذا بعت بأقل منه تخسر المال.",
            "أدنى محصول: إذا حصدت أقل منه تخسر المال.",
            "نسبة المحصول المحفوظة: الماء المالح أو نقص الماء يُضيّعان جزءاً من المحصول.",
            "",
            "تنبيه: هذه تقديرات وليست ضماناً. استشر المرشد الفلاحي.",
        ],
    },
    "ja": {
        "s_main": "収支のまとめ", "s_years": "年ごとの収支", "s_spend": "支出の記録", "s_sales": "売上の記録", "s_help": "使い方",
        "title": "収益性のまとめ", "made": "{d} 作成（{who} 様）", "crop": "作物", "plot": "圃場",
        "h_inputs": "1. あなたの数字：黄色のセルだけを変更してください",
        "area": "作付面積", "yield": "1ヘクタールあたりの予想収穫量", "factor": "収穫が残る割合（塩分・水不足）",
        "price": "1キロの販売価格", "cost_ha": "1ヘクタールあたりの支出（種苗・肥料・人件費・防除）",
        "water": "年間の水と電気代", "fixed": "その他の年間固定費（地代・保険など）",
        "invest": "機械の購入や植え付け（1回のみ）", "years": "何年間で考えますか？", "ramp": "本格的な収穫までの年数（果樹・茶）",
        "u_ha": "ha", "u_kgha": "kg / ha", "u_pct": "%", "u_kg": "kg", "u_years": "年",
        "h_result": "2. 平年の結果",
        "prod": "総収穫量", "money_in": "入るお金（売上）", "money_out": "出るお金（支出）", "depr": "毎年積み立てる機械の分",
        "profit": "1年に手元に残るお金", "ok": "✅ 黒字：お金が増えます", "ko": "❌ 赤字：お金が減ります",
        "min_price": "最低販売価格（これより安いと赤字）", "min_yield": "1ヘクタールあたりの最低収穫量（これより少ないと赤字）",
        "h_scen": "3. 悪い年・良い年は？", "bad": "悪い年（価格 −20%、収穫 −15%）", "normal": "平年", "good": "良い年（価格 +20%、収穫 +10%）",
        "h_risk": "4. アプリで計算したリスク（{n} 回のシミュレーション）", "p_loss": "1年で赤字になる確率", "range": "10年のうち8年は、手元に残るお金が次の範囲",
        "and": "〜", "risk_note": "黄色のセルを変えてもこの値は変わりません。アプリでもう一度計算してください。",
        "h_real": "5. 見込みと実績を比べる（記録から）", "real_sales": "売上", "real_spend": "支出", "real_left": "残るお金（売上 − 支出）", "planned": "見込み", "real": "実績（記録）", "empty_sales": "「売上の記録」に入力してください", "empty_spend": "「支出の記録」に入力してください",
        "y_year": "年", "y_in": "入るお金", "y_out": "出るお金", "y_flow": "その年に残るお金", "y_cum": "開始からの合計",
        "y_note": "0年目は機械の購入や植え付けです。合計がプラスになったら、購入費を回収できたことになります。",
        "y_back": "回収できる年", "y_never": "まだ回収できていません",
        "l_date": "日付", "l_cat": "支出の種類", "l_desc": "内容", "l_amount": "金額", "l_total": "合計",
        "cats": ["種子・苗", "肥料", "水・電気", "人件費", "防除", "運送", "機械・修理", "その他"],
        "v_buyer": "販売先・市場", "v_kg": "販売したキロ数", "v_price": "1キロの価格",
        "help": [
            "このファイルの使い方",
            "1. 「収支のまとめ」シートを開き、黄色のセルだけを実際の数字に変更してください。",
            "2. ほかの数字はすべて自動で計算されます。白いセルには入力しないでください。",
            "3. シーズン中は、支出を「支出の記録」に、売上を「売上の記録」に書きます。",
            "4. 「収支のまとめ」の5番で、実際の売上と支出を比べられます。",
            "5. 「年ごとの収支」で、機械や植え付けの費用をいつ回収できるかが分かります。",
            "",
            "ことばの説明",
            "手元に残るお金：売上から、その年のすべての支出を引いたもの。",
            "最低販売価格：これより安く売ると赤字になります。",
            "最低収穫量：これより少ないと赤字になります。",
            "収穫が残る割合：塩分の多い水や水不足で、収穫の一部が減ります。",
            "",
            "注意：これは見込みであり、保証ではありません。営農指導員にご相談ください。",
        ],
    },
}

def _fmt(wb, **kw):
    base = {"font_name": "Calibri", "font_size": 11, "valign": "vcenter", "font_color": INK}
    base.update(kw)
    return wb.add_format(base)


def _q(sheet):
    return "'" + sheet.replace("'", "''") + "'"


def build(lang, who, crop_name, plot_name, currency, inp, result):
    """Return the .xlsx file as bytes. `inp` and `result` come from engine.economics.simulate.

    Every formula is written together with its computed value, so the numbers show up even in viewers
    that do not recalculate (Excel Protected View, phone previews, mail attachments)."""
    L = T.get(lang) or T["en"]
    rtl = lang == "ar"
    jpy = currency == "JPY"
    money_nf = '#,##0 "¥";-#,##0 "¥"' if jpy else f'#,##0 "{currency}";-#,##0 "{currency}"'
    price_nf = "#,##0" if jpy else "#,##0.00"

    buf = io.BytesIO()
    wb = xlsxwriter.Workbook(buf, {"in_memory": True})
    f_title = _fmt(wb, bold=True, font_size=18)
    f_muted = _fmt(wb, font_color=MUTED)
    f_crop = _fmt(wb, bold=True, font_color=GREEN)
    f_head = _fmt(wb, bold=True, font_size=13, font_color="#FFFFFF", bg_color=HEAD)
    f_label = _fmt(wb, text_wrap=True)
    f_label_b = _fmt(wb, text_wrap=True, bold=True, font_size=13)
    f_unit = _fmt(wb, font_color=MUTED)
    f_note = _fmt(wb, italic=True, font_color=MUTED, font_size=9, text_wrap=True)
    f_verdict = _fmt(wb, bold=True, font_size=14)
    f_green = wb.add_format({"bg_color": GREEN_SOFT})
    f_red = wb.add_format({"bg_color": RED_SOFT})

    def inp_f(nf):
        return _fmt(wb, bg_color=YELLOW, border=1, border_color=LINE, bold=True, font_size=12, num_format=nf)

    def out_f(nf, **kw):
        return _fmt(wb, border=1, border_color=LINE, num_format=nf, **kw)

    # ---------------- values computed in Python (cached results for the formulas) ----------------
    area = round(inp["area_ha"], 2)
    yld = round(inp["yield_kg_ha"])
    factor = round(inp["yield_factor"] * 100, 1)
    price = round(inp["price"], 3)
    cost_ha = round(inp["var_cost_ha"])
    water = round(inp["water_cost"])
    fixed = round(inp["fixed_cost"])
    invest = round(inp["investment"])
    years = int(inp["years"])
    ramp = int(inp["ramp_years"]) if inp.get("perennial") else 0
    prod = area * yld * factor / 100
    money_in = prod * price
    money_out = area * cost_ha + water + fixed
    depr = invest / years if years > 0 else 0
    profit = money_in - money_out - depr
    min_price = (money_out + depr) / prod if prod > 0 else "–"
    min_yield = (money_out + depr) / (price * area) if price * area > 0 else "–"

    # ---------------- Sheet: help (first tab, read once) ----------------
    wh = wb.add_worksheet(L["s_help"][:31])
    if rtl:
        wh.right_to_left()
    wh.set_column(0, 0, 110)
    f_help_h = _fmt(wb, bold=True, font_size=14, text_wrap=True)
    f_help = _fmt(wb, font_size=12, text_wrap=True)
    f_help_w = _fmt(wb, italic=True, font_color="#9B1C1C", text_wrap=True)
    for k, line in enumerate(L["help"]):
        if k == 0 or line in ("Petit lexique", "Small glossary", "معجم صغير", "ことばの説明"):
            fmt = f_help_h
        elif line.startswith(("Attention", "Note", "تنبيه", "注意")):
            fmt = f_help_w
        else:
            fmt = f_help
        wh.write_string(k, 0, line, fmt)

    # ---------------- Sheet: summary ----------------
    main = L["s_main"][:31]
    ws = wb.add_worksheet(main)
    ws.activate()
    if rtl:
        ws.right_to_left()
    ws.set_column(0, 0, 62)
    ws.set_column(1, 1, 18)
    ws.set_column(2, 2, 12)
    ws.set_column(3, 3, 26)
    ws.write_string(0, 0, L["title"], f_title)
    ws.write_string(1, 0, L["made"].format(d=dt.date.today().isoformat(), who=who), f_muted)
    ws.write_string(2, 0, f'{L["crop"]} : {crop_name}' + (f'   ·   {L["plot"]} : {plot_name}' if plot_name else ""), f_crop)

    def head(row, text):
        ws.merge_range(row, 0, row, 3, text, f_head)
        ws.set_row(row, 22)

    def name(n, row, col=1, sheet=main):
        wb.define_name(n, f"={_q(sheet)}!${xl_col_to_name(col)}${row + 1}")

    head(4, L["h_inputs"])
    inputs = [
        ("area", area, L["u_ha"], "0.00"), ("yld", yld, L["u_kgha"], "#,##0"), ("factor", factor, L["u_pct"], "0.0"),
        ("price", price, currency, price_nf), ("cost_ha", cost_ha, currency, money_nf), ("water", water, currency, money_nf),
        ("fixed", fixed, currency, money_nf), ("invest", invest, currency, money_nf), ("years", years, L["u_years"], "0"),
        ("ramp", ramp, L["u_years"], "0"),
    ]
    label_key = {"yld": "yield"}
    r = 5
    for key, val, unit, nf in inputs:
        ws.write_string(r, 0, L[label_key.get(key, key)], f_label)
        ws.write_number(r, 1, val, inp_f(nf))
        ws.write_string(r, 2, unit, f_unit)
        name(f"in_{key}", r)
        r += 1

    r += 1
    head(r, L["h_result"])
    r += 1
    results = [
        ("prod", "=in_area*in_yld*in_factor/100", prod, "#,##0", L["u_kg"]),
        ("money_in", "=res_prod*in_price", money_in, money_nf, ""),
        ("money_out", "=in_area*in_cost_ha+in_water+in_fixed", money_out, money_nf, ""),
        ("depr", "=IF(in_years>0,in_invest/in_years,0)", depr, money_nf, ""),
        ("profit", "=res_money_in-res_money_out-res_depr", profit, money_nf, ""),
    ]
    for key, formula, val, nf, unit in results:
        big = key == "profit"
        ws.write_string(r, 0, L[key], f_label_b if big else f_label)
        ws.write_formula(r, 1, formula, out_f(nf, bold=big, font_size=14 if big else 11), val)
        if unit:
            ws.write_string(r, 2, unit, f_unit)
        name(f"res_{key}", r)
        if big:
            cell = f"B{r + 1}"
            ws.conditional_format(cell, {"type": "cell", "criteria": ">=", "value": 0, "format": f_green})
            ws.conditional_format(cell, {"type": "cell", "criteria": "<", "value": 0, "format": f_red})
        r += 1
    ok, ko = L["ok"], L["ko"]
    ws.write_formula(r, 0, f'=IF(res_profit>=0,"{ok}","{ko}")', f_verdict, ok if profit >= 0 else ko)
    r += 1
    ws.write_string(r, 0, L["min_price"], f_label)
    ws.write_formula(r, 1, '=IF(res_prod>0,(res_money_out+res_depr)/res_prod,"–")', out_f(price_nf), min_price)
    ws.write_string(r, 2, f"{currency}/{L['u_kg']}", f_unit)
    r += 1
    ws.write_string(r, 0, L["min_yield"], f_label)
    ws.write_formula(r, 1, '=IF(in_price*in_area>0,(res_money_out+res_depr)/(in_price*in_area),"–")', out_f("#,##0"), min_yield)
    ws.write_string(r, 2, L["u_kgha"], f_unit)

    r += 2
    head(r, L["h_scen"])
    r += 1
    for key, pm, ym in (("bad", 0.8, 0.85), ("normal", 1.0, 1.0), ("good", 1.2, 1.1)):
        ws.write_string(r, 0, L[key], f_label)
        ws.write_formula(r, 1, f"=res_prod*{ym}*in_price*{pm}-res_money_out-res_depr", out_f(money_nf), prod * ym * price * pm - money_out - depr)
        ws.conditional_format(f"B{r + 1}", {"type": "cell", "criteria": "<", "value": 0, "format": f_red})
        r += 1

    mc = result.get("monte_carlo") or {}
    r += 1
    head(r, L["h_risk"].format(n=mc.get("runs", 0)))
    r += 1
    ws.write_string(r, 0, L["p_loss"], f_label)
    ws.write_number(r, 1, mc.get("prob_loss", 0), out_f("0%"))
    r += 1
    dep_sim = inp["investment"] / max(1, inp["years"])
    ws.write_string(r, 0, L["range"], f_label)
    ws.write_number(r, 1, round(mc.get("p10", 0) - dep_sim), out_f(money_nf))
    ws.write_string(r, 2, L["and"], _fmt(wb, align="center"))
    ws.write_number(r, 3, round(mc.get("p90", 0) - dep_sim), out_f(money_nf))
    r += 1
    ws.write_string(r, 0, L["risk_note"], f_note)

    r += 2
    head(r, L["h_real"])
    r += 1
    # Planned (from the yellow cells) next to real (from the notebooks). An empty notebook says so instead of showing 0.
    f_col = _fmt(wb, bold=True, font_color=MUTED, align="center", text_wrap=True)
    ws.write_string(r, 1, L["planned"], f_col)
    ws.write_string(r, 3, L["real"], f_col)
    r += 1
    f_real = out_f(money_nf, text_wrap=True, font_color=INK)
    ws.write_string(r, 0, L["real_sales"], f_label)
    ws.write_formula(r, 1, "=res_money_in", out_f(money_nf), money_in)
    ws.write_formula(r, 3, f'=IF(COUNT(sales_amounts)=0,"{L["empty_sales"]}",SUM(sales_amounts))', f_real, L["empty_sales"])
    ws.write_string(r + 1, 0, L["real_spend"], f_label)
    ws.write_formula(r + 1, 1, "=res_money_out", out_f(money_nf), money_out)
    ws.write_formula(r + 1, 3, f'=IF(COUNT(spend_amounts)=0,"{L["empty_spend"]}",SUM(spend_amounts))', f_real, L["empty_spend"])
    ws.write_string(r + 2, 0, L["real_left"], _fmt(wb, bold=True, text_wrap=True))
    ws.write_formula(r + 2, 1, f"=B{r + 1}-B{r + 2}", out_f(money_nf, bold=True), money_in - money_out)
    ws.write_formula(r + 2, 3, f'=IF(AND(ISNUMBER(D{r + 1}),ISNUMBER(D{r + 2})),D{r + 1}-D{r + 2},"")', out_f(money_nf, bold=True), "")
    for rr in (r, r + 1, r + 2):
        ws.set_row(rr, 30)

    # ---------------- Sheet: year by year ----------------
    years_name = L["s_years"][:31]
    wy = wb.add_worksheet(years_name)
    if rtl:
        wy.right_to_left()
    wy.set_column(0, 0, 10)
    wy.set_column(1, 3, 18)
    wy.set_column(4, 4, 22)
    wy.set_column(6, 7, 24)
    f_th = _fmt(wb, bold=True, font_color="#FFFFFF", bg_color=HEAD, text_wrap=True)
    f_m = _fmt(wb, num_format=money_nf)
    for j, h in enumerate([L["y_year"], L["y_in"], L["y_out"], L["y_flow"], L["y_cum"]]):
        wy.write_string(0, j, h, f_th)
    wy.write_number(1, 0, 0)
    wy.write_formula(1, 3, "=-in_invest", f_m, -invest)
    wy.write_formula(1, 4, "=D2", f_m, -invest)
    cum, payback = -invest, None
    for t in range(1, YEARS_MAX + 1):
        row = t + 1                      # 0-based row; Excel row number is row + 1
        x = row + 1
        on = t <= years
        rp = 1.0 if ramp <= 0 else min(1.0, max(0.0, (t - 1) / ramp))
        rev = money_in * rp if on else ""
        flow = rev - money_out if on else ""
        if on:
            cum += flow
            if payback is None and cum >= 0:
                payback = t
        ramp_f = f"IF(in_ramp<=0,1,MIN(1,MAX(0,({t}-1)/in_ramp)))"
        wy.write_formula(row, 0, f'=IF({t}<=in_years,{t},"")', None, t if on else "")
        wy.write_formula(row, 1, f'=IF({t}<=in_years,res_money_in*{ramp_f},"")', f_m, rev)
        wy.write_formula(row, 2, f'=IF({t}<=in_years,res_money_out,"")', f_m, money_out if on else "")
        wy.write_formula(row, 3, f'=IF({t}<=in_years,B{x}-C{x},"")', f_m, flow)
        wy.write_formula(row, 4, f'=IF({t}<=in_years,E{x - 1}+D{x},"")', f_m, cum if on else "")
    last = YEARS_MAX + 2
    wy.conditional_format(f"D2:E{last}", {"type": "cell", "criteria": "<", "value": 0, "format": f_red})
    wy.conditional_format(f"D2:E{last}", {"type": "cell", "criteria": ">=", "value": 0, "format": f_green})
    wy.write_string(0, 6, L["y_back"], _fmt(wb, bold=True))
    wy.write_formula(0, 7, f'=IFERROR(INDEX(A3:A{last},MATCH(1,INDEX(ISNUMBER(E3:E{last})*(E3:E{last}>=0),0),0)),"{L["y_never"]}")',
                     _fmt(wb, bold=True, font_size=13, font_color=GREEN), payback if payback else L["y_never"])
    wy.merge_range("G3:H8", L["y_note"], _fmt(wb, italic=True, font_color=MUTED, text_wrap=True, valign="top"))
    wy.freeze_panes(1, 0)

    # ---------------- Sheet: spending notebook ----------------
    spend_name = L["s_spend"][:31]
    wsp = wb.add_worksheet(spend_name)
    if rtl:
        wsp.right_to_left()
    for col, w in enumerate((14, 26, 40, 16, 2, 24, 18)):
        wsp.set_column(col, col, w)
    for j, h in enumerate([L["l_date"], L["l_cat"], L["l_desc"], L["l_amount"]]):
        wsp.write_string(0, j, h, f_th)
    f_in_date = _fmt(wb, bg_color=YELLOW, border=1, border_color=LINE, num_format="yyyy-mm-dd")
    f_in_txt = _fmt(wb, bg_color=YELLOW, border=1, border_color=LINE)
    f_in_money = _fmt(wb, bg_color=YELLOW, border=1, border_color=LINE, num_format=money_nf)
    for row in range(1, LEDGER_ROWS + 1):
        wsp.write_blank(row, 0, None, f_in_date)
        wsp.write_blank(row, 1, None, f_in_txt)
        wsp.write_blank(row, 2, None, f_in_txt)
        wsp.write_blank(row, 3, None, f_in_money)
    wsp.data_validation(1, 1, LEDGER_ROWS, 1, {"validate": "list", "source": L["cats"]})
    wb.define_name("spend_amounts", f"={_q(spend_name)}!$D$2:$D${LEDGER_ROWS + 1}")
    wsp.write_string(0, 5, L["l_total"], _fmt(wb, bold=True))
    wsp.write_formula(0, 6, "=SUM(spend_amounts)", _fmt(wb, bold=True, font_size=13, num_format=money_nf), 0)
    for k, cat in enumerate(L["cats"], 2):
        wsp.write_string(k, 5, cat)
        wsp.write_formula(k, 6, f"=SUMIF($B$2:$B${LEDGER_ROWS + 1},F{k + 1},spend_amounts)", f_m, 0)
    wsp.freeze_panes(1, 0)

    # ---------------- Sheet: sales notebook ----------------
    sales_name = L["s_sales"][:31]
    wsa = wb.add_worksheet(sales_name)
    if rtl:
        wsa.right_to_left()
    for col, w in enumerate((14, 30, 14, 14, 16, 2, 18, 18)):
        wsa.set_column(col, col, w)
    for j, h in enumerate([L["l_date"], L["v_buyer"], L["v_kg"], L["v_price"], L["l_amount"]]):
        wsa.write_string(0, j, h, f_th)
    f_in_kg = _fmt(wb, bg_color=YELLOW, border=1, border_color=LINE, num_format="#,##0")
    f_in_price = _fmt(wb, bg_color=YELLOW, border=1, border_color=LINE, num_format=price_nf)
    f_amount = _fmt(wb, border=1, border_color=LINE, num_format=money_nf)
    for row in range(1, LEDGER_ROWS + 1):
        x = row + 1
        wsa.write_blank(row, 0, None, f_in_date)
        wsa.write_blank(row, 1, None, f_in_txt)
        wsa.write_blank(row, 2, None, f_in_kg)
        wsa.write_blank(row, 3, None, f_in_price)
        wsa.write_formula(row, 4, f'=IF(AND(ISNUMBER(C{x}),ISNUMBER(D{x})),C{x}*D{x},"")', f_amount, "")
    wb.define_name("sales_amounts", f"={_q(sales_name)}!$E$2:$E${LEDGER_ROWS + 1}")
    wsa.write_string(0, 6, L["l_total"], _fmt(wb, bold=True))
    wsa.write_formula(0, 7, "=SUM(sales_amounts)", _fmt(wb, bold=True, font_size=13, num_format=money_nf), 0)
    wsa.freeze_panes(1, 0)

    wb.close()
    return buf.getvalue()
