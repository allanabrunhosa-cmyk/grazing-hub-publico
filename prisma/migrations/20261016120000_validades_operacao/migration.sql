-- Aditiva: preserva pontos, snapshots e responsáveis históricos.
ALTER TABLE "Usuario" ADD COLUMN "responsavelEtiquetaHabilitado" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TrabalhoEtiqueta" ADD COLUMN "copiasBaixadas" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TrabalhoEtiqueta" ADD CONSTRAINT "TrabalhoEtiqueta_copiasBaixadas_check" CHECK ("copiasBaixadas" >= 0 AND "copiasBaixadas" <= "copias");
ALTER TABLE "PontoImpressao" ADD COLUMN "excluidoEm" TIMESTAMP(3);
CREATE TABLE "ResponsavelEtiqueta" (
 "id" TEXT NOT NULL PRIMARY KEY, "lojaId" TEXT NOT NULL DEFAULT 'singleton',
 "nome" VARCHAR(120) NOT NULL, "ativo" BOOLEAN NOT NULL DEFAULT true,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "ResponsavelEtiqueta_lojaId_ativo_idx" ON "ResponsavelEtiqueta"("lojaId", "ativo");

-- Amplia somente os eventos de Validades na projeção vigente.
CREATE OR REPLACE FUNCTION grazing_projetar_atividade(fonte TEXT, registro JSONB) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_id TEXT := nullif(registro->>'id','');
  v_autor TEXT := nullif(coalesce(registro->>'autorId',registro->>'usuarioId',registro->>'responsavelId',registro->>'solicitadoPorId'),'');
  v_nome TEXT := nullif(coalesce(registro->>'autorNome',registro->>'usuarioNome',registro->>'responsavelNome'),'');
  v_ator TEXT := 'USUARIO'; v_ator_ref TEXT; v_iniciador TEXT;
  v_origem TEXT := 'NAO_IDENTIFICADA'; v_modulo TEXT; v_recurso TEXT;
  v_acao TEXT; v_entidade TEXT; v_entidade_id TEXT; v_afetado TEXT;
  v_resumo TEXT; v_resultado TEXT := 'SUCESSO'; v_categoria TEXT := 'OPERACIONAL';
  v_correlacao TEXT; v_loja TEXT := nullif(registro->>'lojaId','');
  v_data TIMESTAMPTZ; v_contexto JSONB := '{}'; v_novo TEXT;
BEGIN
  IF fonte NOT IN ('HistoricoAcesso','HistoricoCadastroVenda','HistoricoPedidoVenda','HistoricoFinanceiroPedido',
    'HistoricoConciliacao','HistoricoCartao','HistoricoPorcaoInsumo','HistoricoOrdemCategoriasPorcoes',
    'PedidoCompraHistorico','EventoAuditoriaEtiqueta','McpEvento','Perda','PerdaExclusao','TentativaEtiqueta') THEN
    RAISE EXCEPTION 'Fonte de atividade não autorizada.' USING ERRCODE = '22023';
  END IF;
  IF v_id IS NULL OR coalesce(registro->>'createdAt',registro->>'criadoEm') IS NULL THEN RETURN NULL; END IF;
  -- DateTime legado usa timestamp sem fuso com conteúdo UTC; nunca depende do TZ da conexão.
  v_data := (coalesce(registro->>'createdAt',registro->>'criadoEm'))::timestamp AT TIME ZONE 'UTC';
  BEGIN
    v_contexto := coalesce(nullif(current_setting('grazing.atividade',true),'')::jsonb,'{}'::jsonb);
  EXCEPTION WHEN invalid_text_representation THEN v_contexto := '{}'; END;
  IF v_contexto->>'origem' IN ('INTERFACE','API','MCP','AUTOMACAO') THEN v_origem := v_contexto->>'origem'; END IF;
  v_correlacao := nullif(v_contexto->>'correlacaoId','');
  v_iniciador := nullif(v_contexto->>'iniciadorId','');

  CASE fonte
    WHEN 'HistoricoAcesso' THEN
      v_modulo := 'acessos'; v_recurso := 'configuracoes.usuarios'; v_categoria := 'ACESSO';
      v_entidade := registro->>'entidade'; v_entidade_id := registro->>'entidadeId';
      IF v_entidade = 'Usuário' THEN v_afetado := v_entidade_id; END IF;
      v_acao := CASE registro->>'acao'
        WHEN 'Usuário criado' THEN 'USUARIO_CRIADO' WHEN 'Usuário atualizado' THEN 'USUARIO_ATUALIZADO'
        WHEN 'Usuário atualizado e senha redefinida' THEN 'USUARIO_ATUALIZADO_SENHA_REDEFINIDA'
        WHEN 'Usuário excluído' THEN 'USUARIO_EXCLUIDO' WHEN 'Usuário ativado' THEN 'USUARIO_ATIVADO'
        WHEN 'Usuário inativado' THEN 'USUARIO_INATIVADO' WHEN 'Perfil criado' THEN 'PERFIL_CRIADO'
        WHEN 'Perfil atualizado' THEN 'PERFIL_ATUALIZADO' WHEN 'Perfil excluído' THEN 'PERFIL_EXCLUIDO'
        WHEN 'Senha redefinida por link de recuperação' THEN 'SENHA_REDEFINIDA'
        ELSE left(regexp_replace(upper(coalesce(registro->>'acao','ALTERACAO_REGISTRADA')),'[^A-Z0-9_]','_','g'),100) END;
      v_resumo := CASE v_acao WHEN 'USUARIO_CRIADO' THEN 'Usuário criado.'
        WHEN 'USUARIO_ATUALIZADO' THEN 'Cadastro e acesso do usuário atualizados.'
        WHEN 'USUARIO_ATUALIZADO_SENHA_REDEFINIDA' THEN 'Cadastro atualizado e senha redefinida, sem registrar segredo.'
        WHEN 'USUARIO_EXCLUIDO' THEN 'Usuário excluído com identidade histórica preservada.'
        WHEN 'USUARIO_ATIVADO' THEN 'Usuário ativado.' WHEN 'USUARIO_INATIVADO' THEN 'Usuário inativado.'
        WHEN 'PERFIL_CRIADO' THEN 'Perfil de acesso criado.' WHEN 'PERFIL_ATUALIZADO' THEN 'Perfil e permissões atualizados.'
        WHEN 'PERFIL_EXCLUIDO' THEN 'Perfil de acesso excluído.' WHEN 'SENHA_REDEFINIDA' THEN 'Senha redefinida por recuperação, sem registrar segredo.'
        ELSE 'Gestão de acesso: alteração registrada.' END;
      IF v_entidade IN ('LANCAMENTO_FINANCEIRO','COMPRA') THEN
        v_modulo := 'financeiro'; v_recurso := 'financeiro.movimentacoes'; v_categoria := 'CRITICA';
        v_resumo := 'Cancelamento financeiro registrado.';
      ELSIF v_entidade = 'LOJA' THEN
        v_modulo := 'cadastros'; v_recurso := 'configuracoes.loja'; v_resumo := 'Dados da empresa alterados.';
      END IF;
    WHEN 'HistoricoCadastroVenda' THEN
      v_entidade := registro->>'entidade'; v_entidade_id := registro->>'registroId'; v_modulo := 'cadastros';
      v_recurso := CASE
        WHEN v_entidade IN ('CLIENTE','SITUACAO_CLIENTE') THEN 'vendas.clientes'
        WHEN v_entidade IN ('FISCAL','GRUPO_FISCAL','EXCLUSAO_GRUPO_FISCAL','SITUACAO_GRUPO_FISCAL') THEN 'vendas.fiscal'
        WHEN v_entidade IN ('FORMA_PAGAMENTO','SITUACAO_FORMA_PAGAMENTO') THEN 'vendas.formas-pagamento'
        WHEN v_entidade = 'HORARIOS_PEDIDOS' THEN 'vendas.horarios'
        WHEN v_entidade = 'ENTREGAS' THEN 'vendas.area-entrega'
        WHEN v_entidade = 'IMPORTACAO' THEN 'vendas.importacao'
        WHEN v_entidade LIKE 'IFOOD%' THEN 'vendas.pedidos'
        WHEN v_entidade = 'PEDIDOS_ESTOQUE_GESTOR' THEN 'vendas.pedidos'
        WHEN v_entidade IN ('PRODUTO','PRECO_PRODUTO','SITUACAO_PRODUTO','EXCLUSAO_PRODUTO','CANAL','CANAL_VENDA','SITUACAO_CANAL','TIPO_EMBALAGEM','PAUSA_COMPLEMENTO_GLOBAL') THEN 'vendas.produtos'
        ELSE 'vendas.catalogo' END;
      v_acao := CASE WHEN v_entidade LIKE 'EXCLUSAO_%' THEN 'EXCLUSAO'
        WHEN v_entidade LIKE 'SITUACAO_%' THEN CASE WHEN registro#>>'{depois,ativo}' = 'true' THEN 'ATIVACAO' ELSE 'INATIVACAO' END
        WHEN v_entidade = 'PRECO_PRODUTO' THEN 'PRECO_ALTERADO'
        WHEN registro->'antes' IS NULL OR registro->'antes' = 'null'::jsonb THEN 'CRIACAO' ELSE 'EDICAO' END;
      v_resumo := CASE v_acao WHEN 'CRIACAO' THEN 'Cadastro comercial criado.' WHEN 'EDICAO' THEN 'Cadastro comercial alterado.'
        WHEN 'EXCLUSAO' THEN 'Cadastro comercial excluído com auditoria preservada.' WHEN 'ATIVACAO' THEN 'Cadastro comercial ativado.'
        WHEN 'INATIVACAO' THEN 'Cadastro comercial inativado.' WHEN 'PRECO_ALTERADO' THEN 'Preço comercial alterado.'
        ELSE 'Cadastro comercial: operação registrada.' END;
      IF v_entidade LIKE 'IFOOD%' THEN v_modulo := 'integracoes'; END IF;
      IF v_entidade IN ('PEDIDOS_ESTOQUE_GESTOR','HORARIOS_PEDIDOS','ENTREGAS') THEN v_modulo := 'pedidos'; END IF;
      IF v_entidade = 'IFOOD_MERCHANT' THEN
        -- O comando gravado é durável; envio/estado incerto não confirma efeito externo.
        v_resultado := CASE
          WHEN registro#>>'{depois,estado}' = 'CONFIRMADA' THEN 'CONFIRMADO'
          WHEN registro#>>'{depois,estado}' = 'RECUSADA' THEN 'NEGADO'
          WHEN registro#>>'{depois,estado}' = 'FALHA' THEN 'FALHA'
          WHEN registro#>>'{depois,estado}' IN ('PENDENTE','ENVIANDO','ENVIADA','INCERTA','AGUARDANDO_CONFERENCIA','INTERVENCAO') THEN 'SOLICITADO'
          ELSE 'SOLICITADO' END;
        v_resumo := CASE v_resultado WHEN 'CONFIRMADO' THEN 'Operação iFood Merchant confirmada por evidência externa.'
          WHEN 'NEGADO' THEN 'Operação iFood Merchant recusada.' WHEN 'FALHA' THEN 'Falha registrada na operação iFood Merchant.'
          ELSE 'Operação iFood Merchant solicitada; resultado externo não confirmado.' END;
      END IF;
      IF v_entidade LIKE 'IFOOD%' AND v_nome = 'Integração iFood' THEN
        v_ator := 'INTEGRACAO'; v_autor := NULL; v_nome := NULL; v_ator_ref := 'IFOOD'; v_origem := 'AUTOMACAO'; v_iniciador := NULL;
        SELECT "autorId" INTO v_iniciador FROM "AcaoMerchantIfood" WHERE "id" = registro#>>'{depois,acaoId}';
      END IF;
    WHEN 'HistoricoPedidoVenda' THEN
      v_modulo := 'pedidos'; v_recurso := 'vendas.pedidos'; v_entidade := 'PedidoVenda'; v_entidade_id := registro->>'pedidoId';
      v_acao := left(coalesce(registro->>'tipo','OPERACAO_REGISTRADA'),100);
      v_correlacao := coalesce(v_correlacao,registro->>'chaveOperacao');
      v_resumo := CASE v_acao WHEN 'CRIADO' THEN 'Orçamento de pedido criado.' WHEN 'RASCUNHO_EDITADO' THEN 'Orçamento de pedido alterado.'
        WHEN 'CONFIRMADO' THEN 'Pedido confirmado.' WHEN 'REVISADO' THEN 'Pedido revisado.'
        WHEN 'INFORMACOES_ATUALIZADAS' THEN 'Informações do pedido atualizadas.' WHEN 'CANCELADO' THEN 'Pedido cancelado.'
        WHEN 'OPERACAO_REAGENDAR' THEN 'Data ou janela do pedido alterada.' WHEN 'OPERACAO_AVANCAR' THEN 'Pedido avançado na operação.'
        WHEN 'OPERACAO_VOLTAR' THEN 'Etapa operacional do pedido retornada.' WHEN 'OPERACAO_ENTREGAR' THEN 'Entrega do pedido registrada.'
        WHEN 'IFOOD_ACAO_SOLICITADA' THEN 'Ação iFood solicitada; resultado externo pendente.'
        WHEN 'IFOOD_EVENTO' THEN 'Evento da integração iFood processado.'
        WHEN 'IFOOD_RECONCILIACAO' THEN 'Resultado de ação iFood conferido por evento externo.'
        ELSE 'Pedido: operação registrada.' END;
      IF v_acao = 'IFOOD_ACAO_SOLICITADA' THEN v_resultado := 'SOLICITADO'; END IF;
      IF v_acao IN ('IFOOD_EVENTO','IFOOD_RECONCILIACAO') OR v_nome = 'Integração iFood' THEN
        v_ator := 'INTEGRACAO'; v_autor := NULL; v_nome := NULL; v_ator_ref := 'IFOOD'; v_origem := 'AUTOMACAO'; v_iniciador := NULL;
        IF v_acao = 'IFOOD_RECONCILIACAO' THEN
          SELECT "autorId" INTO v_iniciador FROM "AcaoIfood" WHERE "id" = registro#>>'{depois,acaoId}';
          v_resultado := CASE WHEN registro#>>'{depois,resultado}' IN ('CONFIRMADA','CONFIRMADO') THEN 'CONFIRMADO'
            WHEN registro#>>'{depois,resultado}' = 'RECUSADA' THEN 'NEGADO' ELSE 'SOLICITADO' END;
        END IF;
      END IF;
    WHEN 'HistoricoFinanceiroPedido' THEN
      v_modulo := 'financeiro'; v_recurso := 'financeiro.movimentacoes'; v_entidade := 'PedidoVenda'; v_entidade_id := registro->>'pedidoId';
      v_acao := left(coalesce(registro->>'tipo','OPERACAO_REGISTRADA'),100); v_categoria := 'CRITICA';
      v_correlacao := coalesce(v_correlacao,registro->>'chaveOperacao'); v_resumo := 'Financeiro do pedido: operação registrada.';
      IF v_acao LIKE '%SOLICIT%' OR v_acao IN ('DEVOLUCAO_ABERTA','DEVOLUCAO_PENDENTE') THEN v_resultado := 'SOLICITADO'; END IF;
    WHEN 'HistoricoConciliacao' THEN
      v_modulo := 'financeiro'; v_recurso := 'financeiro.conciliacao'; v_entidade := 'TransacaoExtrato'; v_entidade_id := registro->>'transacaoId';
      v_acao := left(coalesce(registro->>'acao','OPERACAO_REGISTRADA'),100); v_categoria := 'CRITICA'; v_resumo := 'Conciliação bancária: operação registrada.';
    WHEN 'HistoricoCartao' THEN
      v_modulo := 'financeiro'; v_recurso := CASE WHEN nullif(registro->>'faturaId','') IS NOT NULL THEN 'financeiro.faturas'
        WHEN registro->>'acao' LIKE 'CARTAO_%' THEN 'financeiro.bancario' ELSE 'financeiro.faturas' END;
      v_entidade := CASE WHEN nullif(registro->>'faturaId','') IS NOT NULL THEN 'FaturaCartao' ELSE 'CartaoCredito' END;
      v_entidade_id := coalesce(nullif(registro->>'faturaId',''),registro->>'alvoId'); v_acao := left(coalesce(registro->>'acao','OPERACAO_REGISTRADA'),100);
      v_categoria := 'CRITICA'; v_resumo := 'Cartões e faturas: operação registrada.';
      IF registro->>'origem' = 'MCP' THEN v_origem := 'MCP'; END IF;
    WHEN 'HistoricoPorcaoInsumo' THEN
      v_modulo := 'insumos'; v_recurso := 'suprimentos.porcoes'; v_entidade := 'PorcaoInsumo'; v_entidade_id := registro->>'porcaoId';
      v_acao := left(coalesce(registro->>'acao','OPERACAO_REGISTRADA'),100); v_resumo := 'Tabela de porções: operação registrada.';
    WHEN 'HistoricoOrdemCategoriasPorcoes' THEN
      v_modulo := 'insumos'; v_recurso := 'suprimentos.porcoes'; v_entidade := 'CategoriasPorcoes'; v_entidade_id := 'ordenacao';
      v_acao := 'ORDENACAO_ALTERADA'; v_resumo := 'Categorias de porções reordenadas.';
    WHEN 'PedidoCompraHistorico' THEN
      v_modulo := 'compras'; v_recurso := 'compras'; v_entidade := 'PedidoCompra'; v_entidade_id := registro->>'pedidoId';
      v_acao := left(coalesce(registro->>'acao','ALTERACAO_STATUS'),100); v_resumo := 'Pedido de compra: operação registrada.';
    WHEN 'EventoAuditoriaEtiqueta' THEN
      v_modulo := 'etiquetas'; v_entidade := registro->>'entidade'; v_entidade_id := registro->>'entidadeId';
      v_acao := left(coalesce(registro->>'acao','OPERACAO_REGISTRADA'),100);
      v_recurso := CASE WHEN v_acao = 'CONFIRMADO_PELO_OPERADOR' THEN 'producao.imprimir'
        WHEN v_acao = 'ETIQUETA_BAIXADA' THEN 'producao.validades'
        WHEN v_acao IN ('CONFIGURACAO_ETIQUETA_ALTERADA','CONFIGURACAO_ETIQUETA_CRIADA') THEN 'producao.validades'
        WHEN v_acao = 'PERFIL_IMPRESSORA_SALVO' THEN 'configuracoes.loja' ELSE 'producao' END;
      v_resumo := CASE WHEN v_acao = 'CONFIRMADO_PELO_OPERADOR' THEN 'Impressão física confirmada pelo operador.'
        WHEN v_acao = 'ETIQUETA_BAIXADA' THEN 'Baixa de etiquetas registrada.'
        WHEN v_acao = 'PONTO_EXCLUIDO' THEN 'Ponto de impressão excluído; histórico preservado.'
        WHEN v_acao = 'PREPARADO' THEN 'Etiqueta preparada para impressão.' ELSE 'Configuração de etiquetas alterada.' END;
      IF v_acao = 'CONFIRMADO_PELO_OPERADOR' THEN v_resultado := 'CONFIRMADO'; END IF;
    WHEN 'TentativaEtiqueta' THEN
      v_modulo := 'etiquetas'; v_recurso := 'producao.imprimir'; v_entidade := 'TrabalhoEtiqueta'; v_entidade_id := registro->>'trabalhoId';
      SELECT "lojaId" INTO v_loja FROM "TrabalhoEtiqueta" WHERE "id" = v_entidade_id;
      v_resultado := 'SOLICITADO'; v_acao := 'IMPRESSAO_SOLICITADA'; v_resumo := 'Envio de etiqueta solicitado; impressão física não confirmada.';
      IF registro->>'transporte' = 'ARQUIVO_ZPL' THEN
        v_acao := 'ETIQUETA_EXPORTADA'; v_resultado := 'SUCESSO'; v_resumo := 'Arquivo de etiqueta exportado; impressão física não confirmada.';
      ELSIF EXISTS (SELECT 1 FROM "TentativaEtiqueta" WHERE "trabalhoId" = v_entidade_id AND "id" <> v_id) THEN
        v_acao := 'REIMPRESSAO_SOLICITADA'; v_resumo := 'Novo envio de etiqueta solicitado; impressão física não confirmada.';
      END IF;
    WHEN 'Perda' THEN
      v_modulo := 'estoque'; v_recurso := 'inventario.perdas'; v_entidade := 'Perda'; v_entidade_id := v_id;
      v_acao := 'PERDA_REGISTRADA'; v_resumo := 'Perda de estoque registrada.';
    WHEN 'PerdaExclusao' THEN
      v_modulo := 'estoque'; v_recurso := 'inventario.perdas'; v_entidade := 'Perda'; v_entidade_id := registro->>'perdaId';
      v_acao := 'PERDA_ESTORNADA'; v_resumo := 'Perda excluída com estorno preservado.'; v_categoria := 'CRITICA';
    WHEN 'McpEvento' THEN
      IF registro->>'acao' NOT IN ('NEGOCIO_EXECUTADO','NEGOCIO_PREPARADO','NEGOCIO_APROVADO_HUB') THEN RETURN NULL; END IF;
      v_modulo := 'integracoes'; v_origem := CASE WHEN registro->>'acao' = 'NEGOCIO_APROVADO_HUB' THEN 'INTERFACE' ELSE 'MCP' END;
      v_correlacao := registro->>'correlacao'; v_acao := registro->>'acao';
      v_entidade := 'OperacaoMcp'; v_entidade_id := registro->>'correlacao';
      v_recurso := CASE
        WHEN registro->>'ferramenta' LIKE 'pedidos_%' OR registro->>'ferramenta' LIKE 'ifood_%' THEN 'vendas.pedidos'
        WHEN registro->>'ferramenta' LIKE 'clientes_%' THEN 'vendas.clientes'
        WHEN registro->>'ferramenta' LIKE 'produtos_%' THEN 'vendas.produtos'
        WHEN registro->>'ferramenta' LIKE 'fornecedores_%' THEN 'fornecedores'
        WHEN registro->>'ferramenta' LIKE 'insumos_%' THEN 'insumos'
        WHEN registro->>'ferramenta' LIKE 'porcoes_%' THEN 'suprimentos.porcoes'
        WHEN registro->>'ferramenta' LIKE 'compras_%' THEN 'compras'
        WHEN registro->>'ferramenta' LIKE 'perdas_%' THEN 'inventario.perdas'
        WHEN registro->>'ferramenta' LIKE 'contagens_%' THEN 'inventario.contagem'
        WHEN registro->>'ferramenta' LIKE 'estoque_%' THEN 'inventario'
        WHEN registro->>'ferramenta' LIKE 'etiquetas_%' THEN 'producao.imprimir'
        WHEN registro->>'ferramenta' LIKE 'faturas_%' THEN 'financeiro.faturas'
        WHEN registro->>'ferramenta' LIKE 'financeiro_%' THEN 'financeiro.movimentacoes'
        ELSE 'configuracoes.mcp' END;
      v_resumo := 'Operação MCP registrada após validação da identidade.';
      v_resultado := CASE WHEN v_acao = 'NEGOCIO_PREPARADO' THEN 'SOLICITADO'
        WHEN registro->>'resultado' = 'OK' THEN 'SUCESSO' ELSE 'FALHA' END;
  END CASE;
  IF v_ator = 'USUARIO' AND v_autor IS NULL THEN RETURN NULL; END IF;
  IF v_ator = 'USUARIO' AND v_nome IS NULL THEN SELECT "nome" INTO v_nome FROM "Usuario" WHERE "id" = v_autor; END IF;
  INSERT INTO "AtividadeUsuario" ("ocorridoEm","autorId","autorNome","atorTipo","atorReferencia","iniciadorId","origem",
    "modulo","recurso","acao","entidade","entidadeId","usuarioAfetadoId","resumo","resultado","categoria","correlacaoId","fonteTabela","fonteId","lojaId")
  VALUES (v_data,v_autor,left(v_nome,120),v_ator,left(v_ator_ref,120),v_iniciador,v_origem,v_modulo,v_recurso,left(v_acao,100),
    left(v_entidade,80),left(v_entidade_id,160),v_afetado,v_resumo,v_resultado,v_categoria,left(v_correlacao,160),fonte,left(v_id,160),v_loja)
  ON CONFLICT ("fonteTabela","fonteId") DO NOTHING RETURNING "id" INTO v_novo;
  IF v_novo IS NULL THEN SELECT "id" INTO v_novo FROM "AtividadeUsuario" WHERE "fonteTabela" = fonte AND "fonteId" = v_id; END IF;
  RETURN v_novo;
END;
$$;
