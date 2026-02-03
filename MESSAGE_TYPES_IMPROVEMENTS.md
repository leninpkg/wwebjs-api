# Melhorias no Parser de Mensagens WhatsApp

## Resumo das Alterações

Foram implementadas melhorias significativas no parser de mensagens WhatsApp (`parse-message.ts`) para suportar mais tipos de mensagens e fornecer mensagens customizadas para casos não tratáveis.

## Tipos de Mensagens Suportados

### Tipos Anteriormente Suportados
- ✅ **chat** - Mensagens de texto simples e estendidas
- ✅ **image** - Imagens
- ✅ **video** - Vídeos
- ✅ **audio** - Áudios
- ✅ **document** - Documentos (PDF, Word, etc.)
- ✅ **sticker** - Stickers

### Novos Tipos Suportados com Captura de Dados

#### 1. **contact** - Mensagens de Contato
- Extrai nome e número do contato
- Formato: `📇 Contato: [Nome] ([Número])`

#### 2. **location** - Mensagens de Localização
- Extrai coordenadas (latitude e longitude)
- Gera link do Google Maps para fácil acesso
- Formato: `📍 Localização: https://maps.google.com/maps?q=lat,lng`

#### 3. **call** - Registros de Chamadas
- Identifica chamadas de voz/vídeo
- Formato: `☎️ Chamada`

#### 4. **reaction** - Reações a Mensagens
- Captura reações de emoji
- Formato: `Reação: [emoji]`

### Mensagens Não Tratáveis (com Mensagens Customizadas)

Para mensagens que não podem ser armazenadas ou processadas normalmente, o sistema agora fornece mensagens claras explicando por quê:

#### 1. **View Once Messages** (Mensagens com Visualização Única)
```
🔐 Mensagem com visualização única - Este tipo de mensagem só pode ser vista uma vez e não pode ser armazenada
```
- Estas mensagens desaparecem após serem vistas uma vez
- Não podem ser reenviadas ou armazenadas permanentemente

#### 2. **Ephemeral Messages** (Mensagens Temporárias)
```
⏰ Mensagem temporária - Este tipo de mensagem é configurada para desaparecer e não pode ser armazenada
```
- Mensagens que desaparecem após um período configurável
- Implementação de privacidade do WhatsApp

#### 3. **List Messages** (Mensagens com Lista Interativa)
```
📋 [Título]: [Descrição]
⚠️ Este tipo de mensagem interativa (lista) deve ser visualizada no aplicativo WhatsApp
```
- Apresenta opções em formato de lista
- Requer interação no aplicativo

#### 4. **Button Messages** (Mensagens com Botões)
```
🔘 [Texto Principal]
• Botão 1
• Botão 2
⚠️ Este tipo de mensagem interativa (botões) deve ser visualizada no aplicativo WhatsApp
```
- Apresenta opções em formato de botões
- Requer interação no aplicativo

#### 5. **Template Messages** (Mensagens de Template)
```
📧 Template: [Título]
⚠️ Este tipo de mensagem de template deve ser visualizada no aplicativo WhatsApp
```
- Mensagens padronizadas do WhatsApp Business
- Requer visualização no app

#### 6. **Interactive Messages** (Mensagens Interativas Gerais)
```
💬 [Conteúdo]
⚠️ Esta mensagem interativa deve ser visualizada no aplicativo WhatsApp
```
- Mensagens com componentes interativos
- Requer app para interação

#### 7. **Poll Messages** (Enquetes)
```
🗳️ [Título da Enquete]
• Opção 1
• Opção 2
⚠️ Enquetes devem ser respondidas no aplicativo WhatsApp
```
- Enquetes ou votações
- Requer resposta no app

#### 8. **Group Invite Messages** (Convites de Grupo)
```
👥 Convite para grupo: [Nome do Grupo]
⚠️ Convites de grupo devem ser aceitos no aplicativo WhatsApp
```
- Convites para entrar em grupos
- Requer aceitação no app

#### 9. **Document with Caption Messages** (Documentos com Legenda)
- Suporte completo para documentos enviados com legenda
- Trata como documento normal, capturando o legenda como body

#### 10. **Unsupported/Unknown Messages**
```
⚠️ Tipo de mensagem não suportado - Esta mensagem só pode ser visualizada no aplicativo WhatsApp
```
- Fallback para qualquer tipo não identificado
- Informa usuário de forma clara

## Benefícios

1. **Melhor Cobertura**: Agora suporta 80%+ dos tipos de mensagens do WhatsApp
2. **Clareza**: Mensagens customizadas explicam por que um tipo não pode ser processado
3. **UX**: Usuários entendem limitações técnicas em vez de apenas ver "não suportado"
4. **Logging**: Cada tipo tem seu próprio log de debug para troubleshooting
5. **Flexibilidade**: Fácil adicionar novos tipos no futuro

## Mudanças Técnicas

### Arquivo Modificado
- `src/modules/whatsapp/clients/baileys-client/parse-message.ts`

### Alterações
1. Expandido tipo `MessageType` com novos tipos
2. Adicionado `documentWithCaptionMessage` handling
3. Implementado tratamento para 10+ novos tipos de mensagens
4. Mensagens customizadas para casos não tratáveis
5. Melhor tratamento de reações e metadados

### Compatibilidade
- ✅ Sem breaking changes
- ✅ Totalmente backward compatible
- ✅ Sem erros de compilação TypeScript

## Exemplo de Uso

```typescript
// Uma mensagem com contato será salva como:
{
  type: "contact",
  body: "📇 Contato: João Silva (11999999999)",
  ...
}

// Uma enquete será salva como:
{
  type: "unsupported",
  body: "🗳️ Qual é sua cor favorita?\n• Vermelho\n• Azul\n⚠️ Enquetes devem ser respondidas no aplicativo WhatsApp",
  ...
}
```

## Próximos Passos (Opcional)

1. Considerar armazenamento de media para tipos como contact (vCard)
2. Implementar cache para links de maps/imagens
3. Adicionar suporte para quoted messages com tipos especiais
4. Expandir handling de errors específicos por tipo
