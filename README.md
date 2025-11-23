# Reconhecimento_fala

Este repositório agora inclui um agente de ideias para WhatsApp pensado para a Load Arquitetura.

## Agente de ideias para WhatsApp
O arquivo `agente_whatsapp.py` gera respostas prontas para serem enviadas pelo WhatsApp ao time interno. Ele sempre sugere entre 5 e 10 ideias de vídeos alinhadas aos pilares da marca (funcionalidade, acessibilidade e propósito).

### Uso rápido (local)
```bash
python agente_whatsapp.py "Quero vídeos longos sobre reformas acessíveis" --quantidade 8
```
A saída já vem formatada para copiar e colar no WhatsApp, com título, objetivo, formato e gancho de abertura.

### Integrando com o WhatsApp
1. Crie ou habilite um número de WhatsApp empresarial (ex.: Twilio Sandbox ou API oficial).
2. Aponte o webhook de mensagens recebidas para um endpoint seu (Flask, FastAPI, etc.).
3. Dentro desse endpoint, use a função `handle_whatsapp_message` para gerar a resposta:

```python
from agente_whatsapp import handle_whatsapp_message

@app.post("/webhook-whatsapp")
def receber_mensagem():
    texto = request.form.get("Body", "")  # mensagem recebida
    resposta = handle_whatsapp_message(texto)
    return resposta  # envie como mensagem de volta pelo provedor
```
4. Publique o serviço em um endereço público HTTPS e configure-o no provedor escolhido.

> O agente não conversa com usuários finais; ele apoia o time interno com ideias claras, empáticas e aplicáveis à rotina da Load.
