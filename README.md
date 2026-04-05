# Next.js Rakendus

See projekt on Next.js põhine veebirakendus.

## Arenduse alustamine

1. Paigalda sõltuvused:
   ```
npm install
   ```
2. Käivita arendusserver:
   ```
npm run dev
   ```

## Build ja deployment

1. Ehita projekt:
   ```
npm run build
   ```
2. Käivita production server:
   ```
npm start
   ```

## Koodistiil
- ESLint ja Prettier on seadistatud automaatseks koodi kontrolliks ja vormindamiseks.

## 404 ja 500 lehed
- Kohandatud 404 (not-found.tsx) ja üldine vealeht (error.tsx) on olemas.

## Deployment
- Soovitatav kasutada Vercel või Netlify platvormi kiireks deploymentiks.

## Teadmistebaasi turve ja püsivus

- `/api/knowledge` on nüüd admin-tokeniga kaitstud. Seadista `KNOWLEDGE_ADMIN_TOKEN` ning saada see kliendist headeris `x-knowledge-admin-token`.
- Chat route loeb teadmistebaasi endiselt serveris, kuid teadmisekirjed lisatakse süsteemprompti ainult lisakontekstina ega tohi tühistada süsteemi- ega ohutusreegleid.
- Teadmistebaas ei ole enam ainult protsessimälus.
- Kui `KV_REST_API_URL` ja `KV_REST_API_TOKEN` on olemas, salvestatakse teadmistebaas jagatud Vercel KV-sse mitme instantsi jaoks.
- Kui KV pole seadistatud, kasutatakse lokaalses arenduses faili `data/knowledge-store.json`.

## Pildigeneratsioon ComfyUI kaudu

Rakendus toetab nüüd pildiloomet eraldi /api/image route kaudu. Selle jaoks lisa Vercelis või lokaalsesse .env.local faili järgmised muutujad:

### Lihtsaim variant: Replicate

Kui tahad kõige kiiremini tööle saada, lisa ainult need muutujad:

```env
REPLICATE_API_TOKEN=r8_voi_muu_sinu_token
REPLICATE_MODEL=black-forest-labs/flux-schnell
REPLICATE_ASPECT_RATIO=1:1
REPLICATE_OUTPUT_FORMAT=png
REPLICATE_OUTPUT_QUALITY=100
```

Märkused:
- See on lihtsaim tee, sest oma GPU serverit pole vaja.
- Vaikimisi kasutatakse Flux Schnell mudelit Replicate'i kaudu.
- Kui REPLICATE_API_TOKEN on olemas, kasutab app kõigepealt Replicate'it.

### Vabama kontrolliga variant: ComfyUI

```env
COMFYUI_BASE_URL=http://sinu-comfyui-server:8188
COMFYUI_CHECKPOINT_NAME=flux1-dev.safetensors
COMFYUI_API_KEY=
COMFYUI_NEGATIVE_PROMPT=low quality, blurry, distorted, deformed, bad anatomy, extra fingers, watermark, text
COMFYUI_WIDTH=576
COMFYUI_HEIGHT=576
COMFYUI_STEPS=12
COMFYUI_CFG=3.8
COMFYUI_SAMPLER=dpmpp_2m
COMFYUI_SCHEDULER=karras
```

Märkused:
- COMFYUI_BASE_URL peab olema serverist kättesaadav ComfyUI endpoint.
- COMFYUI_CHECKPOINT_NAME peab täpselt vastama sinu ComfyUI-s olemasoleva mudelifaili nimele.
- Kui ComfyUI kasutab autentimist, lisa COMFYUI_API_KEY.
- Kui COMFYUI_BASE_URL on olemas, pannakse pilditöö ComfyUI järjekorda ja UI kontrollib selle olekut eraldi, nii et brauser ei jää ühe pika requesti taha kinni.
- Viitepildiga image-to-image töötab nüüd ka ComfyUI kaudu: rakendus laeb viitepildi ComfyUI `upload/image` endpointi ja ehitab sellest `LoadImage -> VAEEncode -> KSampler` workflow.
- Kui REPLICATE_API_TOKEN puudub, proovib app kasutada ComfyUI backendit.
- UI-s saad pildireziimi sisse lülitada nupuga Loo pilt.
- Kui tahad sinu setupi jaoks paremat tasuta mudelit, alusta SD1.5 perekonnast mudeliga DreamShaper 8. See järgib prompti paremini kui tavaline v1.5 pruned checkpoint ja sobib endiselt ComfyUI CPU/AMD-sõbralikuks kasutuseks.

### Backend health ja pildi staatused

- `/api/backends/health` kontrollib ComfyUI ja Replicate seisu.
- UI näitab pildireziimis eraldi staatuseid `queued`, `running`, `enhancing` ja `done`.
- Kui `enhance` on sees, tehakse upscale eraldi järel-sammuna, mitte ei peideta seda `running` alla.
- Turvalisuse pärast aktsepteerib `/api/image` kliendilt saadetud `imageDataUrl` ja `referenceImageDataUrl` välju ainult base64 `data:image/...;base64,...` kujul, mitte suvaliste HTTP/HTTPS URL-idena.

### Vercel deploy

See repo on nüüd lingitud Verceli projektiga `valdo-ai-app`.

Oluline piirang:
- `localhost` aadressid ei tööta Vercelis. Kui tahad ComfyUI tuge productionis, peab `COMFYUI_BASE_URL` viitama avalikult kättesaadavale backendile.
- Kui sul avalikku pildibackendit ei ole, siis productionis on mõistlik kasutada `REPLICATE_API_TOKEN` põhist varianti.

Soovitatavad Verceli env-id:

```env
GROQ_API_KEY=
REPLICATE_API_TOKEN=
REPLICATE_MODEL=black-forest-labs/flux-schnell
REPLICATE_ASPECT_RATIO=1:1
REPLICATE_OUTPUT_FORMAT=png
REPLICATE_OUTPUT_QUALITY=100

# ainult siis, kui backend on avalik
COMFYUI_BASE_URL=
COMFYUI_CHECKPOINT_NAME=
COMFYUI_API_KEY=
COMFYUI_NEGATIVE_PROMPT=
COMFYUI_WIDTH=
COMFYUI_HEIGHT=
COMFYUI_STEPS=
COMFYUI_CFG=
COMFYUI_SAMPLER=
COMFYUI_SCHEDULER=
```
