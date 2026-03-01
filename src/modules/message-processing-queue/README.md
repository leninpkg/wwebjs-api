# Message Processing Queue - Arquitetura com SOLID Principles

## 📋 Visão Geral

O novo Builder Pattern implementa os 5 princípios SOLID para criar uma `MessageProcessingQueue` com máxima flexibilidade e desacoplamento.

## 🏗️ Arquitetura

### Interfaces Segregadas (SOLID-I)

```typescript
// 1. IQueueLogger - Interface para logging
interface IQueueLogger {
  error(error: unknown, message: string): void;
  warn(error: unknown, message: string): void;
  info(message: string): void;
}

// 2. IMessageHandler - Interface para processamento
interface IMessageHandler {
  handle(messageId: string): Promise<void>;
}

// 3. IMessageProcessingQueueBuilder - Interface para o builder
interface IMessageProcessingQueueBuilder {
  withSessionId(sessionId: string): IMessageProcessingQueueBuilder;
  withLogger(logger: IQueueLogger): IMessageProcessingQueueBuilder;
  withReceiveHandler(handler: IMessageHandler): IMessageProcessingQueueBuilder;
  withEditHandler(handler: IMessageHandler): IMessageProcessingQueueBuilder;
  withPollInterval(intervalMs: number): IMessageProcessingQueueBuilder;
  withMaxAttempts(attempts: number): IMessageProcessingQueueBuilder;
  withConcurrency(maxConcurrent: number): IMessageProcessingQueueBuilder;
  withBackoffStrategy(strategy: BackoffStrategy): IMessageProcessingQueueBuilder;
  build(): MessageProcessingQueue;
  validate(): void;
}
```

### Builder Pattern (SOLID-S)

```typescript
class MessageProcessingQueueBuilder implements IMessageProcessingQueueBuilder {
  // Responsabilidade única: construir a queue
  // Valida configurações
  // Retorna objeto pronto para usar
}
```

### Backoff Strategies (SOLID-O, SOLID-L)

```typescript
// Aberto para extensão, fechado para modificação
interface BackoffStrategy {
  getNextAttemptAt(attempt: number): Date;
}

class IncreasingBackoffStrategy implements BackoffStrategy { ... }
class LinearBackoffStrategy implements BackoffStrategy { ... }
// Adicione novas strategies sem modificar o builder
```

## 🎯 Princípios SOLID Aplicados

### S - Single Responsibility
- **Builder**: responsável APENAS por construir a queue
- **Logger**: responsável APENAS por logging
- **Handler**: responsável APENAS por processar mensagens
- **BackoffStrategy**: responsável APENAS por calcular delays

### O - Open/Closed
- Precisar de um novo logger? Implemente `IQueueLogger`
- Precisar de novo handler? Implemente `IMessageHandler`
- Precisar de novo backoff? Implemente `BackoffStrategy`
- **Sem modificar código existente**

### L - Liskov Substitution
- Qualquer `IQueueLogger` é substitível no builder
- Qualquer `IMessageHandler` funciona como RECEIVE ou EDIT
- Qualquer `BackoffStrategy` pode ser injetado
- Comportamento mantém contrato das interfaces

### I - Interface Segregation
- `IQueueLogger` tem apenas 3 métodos necessários
- `IMessageHandler` tem apenas 1 método
- Classes não são forçadas a implementar métodos não usados
- Cada interface é mínima e focada

### D - Dependency Inversion
- Builder depende de **abstrações** (`IQueueLogger`, `IMessageHandler`)
- **NÃO depende** de implementações concretas
- Inversão de controle: caller injeta dependências
- Fácil trocar implementações sem modificar builder

## 📝 Como Usar

### Passo 1: Implementar as Interfaces

```typescript
import { IQueueLogger, IMessageHandler } from "@modules/message-processing-queue";

class MyLogger implements IQueueLogger {
  error(error: unknown, message: string): void {
    console.error(`[ERROR] ${message}`, error);
  }

  warn(error: unknown, message: string): void {
    console.warn(`[WARN] ${message}`, error);
  }

  info(message: string): void {
    console.info(`[INFO] ${message}`);
  }
}

class MyReceiveHandler implements IMessageHandler {
  async handle(messageId: string): Promise<void> {
    // Implementar lógica de recebimento
    console.log(`Processing RECEIVE for message: ${messageId}`);
  }
}

class MyEditHandler implements IMessageHandler {
  async handle(messageId: string): Promise<void> {
    // Implementar lógica de edição
    console.log(`Processing EDIT for message: ${messageId}`);
  }
}
```

### Passo 2: Criar a Queue com Builder

```typescript
import { createQueueBuilder, IncreasingBackoffStrategy } from "@modules/message-processing-queue";

const queue = createQueueBuilder()
  .withSessionId("session-123")
  .withLogger(new MyLogger())
  .withReceiveHandler(new MyReceiveHandler())
  .withEditHandler(new MyEditHandler())
  .withBackoffStrategy(new IncreasingBackoffStrategy())
  .withPollInterval(1000)
  .withMaxAttempts(5)
  .withConcurrency(1)
  .build();

queue.start();
```

### Passo 3: Usar a Queue

```typescript
// Enfileirar processamento de recebimento
await queue.enqueueReceive("messageId-123");

// Enfileirar processamento de edição
await queue.enqueueEdit("messageId-456");

// Parar a queue quando não for mais necessária
queue.stop();
```

## 💡 Exemplos Avançados

### Validações Automáticas

```typescript
// ❌ Falta sessionId
try {
  createQueueBuilder()
    .withLogger(new MyLogger())
    .withReceiveHandler(new MyReceiveHandler())
    .withEditHandler(new MyEditHandler())
    .withBackoffStrategy(new IncreasingBackoffStrategy())
    .build();
} catch (error) {
  console.error((error as Error).message); // "sessionId is required"
}

// ❌ Falta backoffStrategy (NÃO tem default!)
try {
  createQueueBuilder()
    .withSessionId("session-123")
    .withLogger(new MyLogger())
    .withReceiveHandler(new MyReceiveHandler())
    .withEditHandler(new MyEditHandler())
    // .withBackoffStrategy(...) <- OBRIGATÓRIO!
    .build();
} catch (error) {
  console.error((error as Error).message); 
  // "backoffStrategy is required - use withBackoffStrategy()"
}

// ❌ Intervalo de polling inválido
try {
  createQueueBuilder()
    .withPollInterval(0) // Deve ser > 0
    .build();
} catch (error) {
  console.error((error as Error).message);
  // "Poll interval must be greater than 0"
}

// ❌ Concorrência inválida
try {
  createQueueBuilder()
    .withConcurrency(-1) // Deve ser >= 1
    .build();
} catch (error) {
  console.error((error as Error).message);
  // "Concurrency must be at least 1"
}
```

### Padrão Adapter com Baileys Logger

Se você já tem um logger do Baileys (`ILogger`), use um adapter:

```typescript
import type { ILogger } from "baileys/lib/Utils/logger";
import { IQueueLogger } from "@modules/message-processing-queue";

/**
 * Adapter que transforma um ILogger do Baileys em IQueueLogger
 */
class BaileysLoggerAdapter implements IQueueLogger {
  constructor(private baileysLogger: ILogger) {}

  error(error: unknown, message: string): void {
    this.baileysLogger.error(error, message);
  }

  warn(error: unknown, message: string): void {
    this.baileysLogger.warn(error, message);
  }

  info(message: string): void {
    this.baileysLogger.info(message);
  }
}

// Usar o adapter
const queue = createQueueBuilder()
  .withSessionId("session-123")
  .withLogger(new BaileysLoggerAdapter(baileysLogger))
  .withReceiveHandler(new MyReceiveHandler())
  .withEditHandler(new MyEditHandler())
  .withBackoffStrategy(new IncreasingBackoffStrategy())
  .build();
```

### Criar Estratégia de Backoff Customizada

```typescript
import { BackoffStrategy } from "@modules/message-processing-queue";

/**
 * Estratégia de backoff sem delay
 * Retenta imediatamente
 */
class NoDelayBackoffStrategy implements BackoffStrategy {
  getNextAttemptAt(_attempt: number): Date {
    return new Date(); // Retenta imediatamente
  }
}

/**
 * Estratégia de backoff com Jitter
 * Evita "thundering herd" quando múltiplos jobs falham simultaneamente
 */
class JitterBackoffStrategy implements BackoffStrategy {
  private readonly baseDelays = [1000, 5000, 15000, 30000, 60000];

  getNextAttemptAt(attempt: number): Date {
    const baseIndex = Math.min(attempt - 1, this.baseDelays.length - 1);
    const baseDelay = this.baseDelays[baseIndex] ?? 60000;
    
    // Adiciona jitter (variação aleatória de ±10%)
    const jitter = Math.random() * baseDelay * 0.1;
    return new Date(Date.now() + baseDelay + jitter);
  }
}

// Usar com a queue
const queue = createQueueBuilder()
  .withSessionId("session-123")
  .withLogger(new MyLogger())
  .withReceiveHandler(new MyReceiveHandler())
  .withEditHandler(new MyEditHandler())
  .withBackoffStrategy(new JitterBackoffStrategy()) // ✅ Funciona!
  .build();
```

**Importante**: Se você deletar `IncreasingBackoffStrategy` no futuro, **o builder NÃO quebra**, pois ele depende apenas da interface `BackoffStrategy`. Isso é **Dependency Inversion** (D de SOLID)!

## 📂 Estrutura de Arquivos

```
message-processing-queue/
├── queue.ts                          # Classe principal da fila
├── types.ts                          # Tipos e interfaces internas
├── builder.ts                        # Builder pattern
├── contracts.ts                      # Interfaces SOLID (IQueueLogger, IMessageHandler, etc)
├── listener.ts                       # Event listener tipado
│
├── strategies/
│   └── backoff/
│       ├── backoff.strategy.ts       # Interface BackoffStrategy
│       ├── increasing-backoff.strategy.ts
│       └── linear-backoff.strategy.ts
│
├── processors/
│   ├── job-processor.ts              # Interface JobProcessor
│   ├── receive-processor.ts          # Implementação stub
│   └── edit-processor.ts             # Implementação stub
│
├── index.ts                          # Exports públicos
└── README.md                         # Este arquivo (documentação)
```

## 🚀 Próximas Steps

1. Implementar `ReceiveProcessor` e `EditProcessor` com lógica real
2. Integrar com `PrismaBaileysStore` usando o builder
3. Adicionar métricas de monitoramento
4. Expandir estratégias de backoff (Jitter, Exponential, etc)
5. Adicionar testes unitários usando mocks das interfaces

---

**Princípios SOLID garantem:**
✅ Fácil adicionar novos loggers
✅ Fácil adicionar novos handlers
✅ Fácil adicionar novas estratégias de backoff
✅ Fácil testar (usar mocks das interfaces)
✅ Fácil manter (cada classe tem uma responsabilidade)
✅ Fácil reutilizar (interfaces bem definidas)
