"""
Resumo anual do negócio (ver skill `project-context`): histórico mês a mês dos
principais números de produção/comissão/seguro, pra alimentar os gráficos da
tela `/dashboard/resumo`. Construído em cima de `get_base_final_rows` (mesma
fonte de verdade da tabela contrato-a-contrato) — cada mês do ano pedido é
somado/contado, não recalculado com lógica própria.

`meta_producao` é a única peça que NÃO vem de `base_final`: é a meta de
produção por filial (`producao_por_filial`, dimensão "R$ Meta", vinda da aba
`db_Metas`). Essa aba só cobre 18 filiais "grandes" (ver rpa-conventions) —
pedir uma filial fora dessa lista devolve `meta_producao=None` em todo mês,
o que é uma limitação real do dado de origem, não um bug.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.models.metric import Metric
from app.services.base_final import _strip_filial_code, get_base_final_rows
from app.services.connectors.base import parse_looker_number


def _meta_producao_por_mes(db: Session, ano: int, mes: int, filial: str | None) -> float | None:
    periodo = date(ano, mes, 1)
    metas = db.query(Metric).filter(Metric.metric_name == "producao_por_filial", Metric.metric_date == periodo).all()
    if not metas:
        return None
    total = 0.0
    encontrou = False
    for m in metas:
        dims = m.dimensions or {}
        if filial is not None and _strip_filial_code(dims.get("Filial")) != filial:
            continue
        raw = dims.get("R$ Meta")
        if raw is None:
            continue
        total += parse_looker_number(raw)
        encontrou = True
    return round(total, 2) if encontrou else None


def get_resumo_mensal(
    db: Session, ano: int, mes_inicio: int = 1, mes_fim: int = 12, filial: str | None = None
) -> dict:
    meses_out: list[dict] = []
    filiais_vistas: set[str] = set()

    for mes in range(mes_inicio, mes_fim + 1):
        rows = get_base_final_rows(db, ano=ano, mes=mes)
        for r in rows:
            if r["area_loja_ehs"]:
                filiais_vistas.add(r["area_loja_ehs"])
        if filial is not None:
            rows = [r for r in rows if r["area_loja_ehs"] == filial]

        def soma(campo: str) -> float:
            return round(sum(r[campo] or 0.0 for r in rows), 2)

        qtd_seguro_sim = sum(1 for r in rows if r["id_seguro"] == "SIM")
        qtd_seguro_nao = sum(1 for r in rows if r["id_seguro"] == "NÃO")
        qtd_spf_sim = sum(1 for r in rows if r["id_spf"] == "SIM")
        qtd_spp_sim = sum(1 for r in rows if r["id_spp"] == "SIM")

        meses_out.append(
            {
                "ano": ano,
                "mes": mes,
                "qtd_contratos": len(rows),
                "qtd_seguro_sim": qtd_seguro_sim,
                "qtd_seguro_nao": qtd_seguro_nao,
                "qtd_spf_sim": qtd_spf_sim,
                "qtd_spp_sim": qtd_spp_sim,
                "vl_financiamento": soma("valor_financiamento"),
                "meta_producao": _meta_producao_por_mes(db, ano, mes, filial),
                "vl_principal": soma("valor_principal"),
                "vl_comissionado_ehs": soma("valor_comissionado_ehs"),
                "vl_seguro_total": soma("valor_seguro_total"),
                "vl_seguro_prestamista": soma("valor_seguro_prestamista"),
                "vl_seguro_ap": soma("valor_seguro_ap"),
                "vl_seguro_outros": soma("valor_seguro_outros"),
                "comissao_final": soma("comissao_final"),
            }
        )

    return {
        "ano": ano,
        "filial": filial,
        "filiais": sorted(filiais_vistas),
        "meses": meses_out,
    }
