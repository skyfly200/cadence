# Running Laya for Cadence's heap triage

[Laya](https://github.com/NandhaKishorM/laya) is a small decision model (Apache 2.0). Cadence's **Tidy** button
can ask it which tag fits each heap item and how big the item is, through the Jev `/v1/systemone` protocol.
It is optional: with `TRIAGE_BASE_URL` unset, or Laya unreachable, Tidy uses Claude for everything.

Cadence's server calls Laya, not the browser. Laya therefore has to be reachable from wherever Cadence runs
(Vercel), and its API key never reaches the browser.

Figures for memory and free allowances below are approximate. Check Laya's docs and Google's pricing page.

## 1. Run it on your computer first

With Docker, from a clone of the Laya repo:

```bash
export LAYA_API_KEY=local-dev-key
MODELSCOPE_MODEL=english LAYA_MODELS=english docker compose \
  -f compose.yaml -f compose.http.yaml -f compose.modelscope.yaml up --build laya-serve
curl localhost:8000/health
```

Or without Docker (downloads the weights from Hugging Face on first start):

```bash
python -m venv .venv && . .venv/bin/activate && pip install "laya[serve]"
LAYA_API_KEY=local-dev-key LAYA_MODELS=english laya-serve
```

Check one answer:

```bash
curl -s localhost:8000/v1/systemone -H "Authorization: Bearer local-dev-key" -H 'content-type: application/json' -d '{
  "state": "Call the school about the field trip",
  "model": "english",
  "questions": {"size": {"type": "choice", "instructions": "How much work is this?",
    "criteria": {"quick": "under 15 minutes", "short": "15 to 45 minutes", "long": "half a day or more"}}}}'
```

**Measure its memory** while it answers (`docker stats`, or Activity Monitor / `top`). Use that number, plus some
headroom, for the Cloud Run size in step 3. Laya's docs recommend 8 GB for the quickstart with every checkpoint;
the English checkpoint alone should need less, but I have not measured it.

Point a local Cadence at it in `.env`:

```
TRIAGE_BASE_URL=http://localhost:8000
TRIAGE_API_KEY=local-dev-key
TRIAGE_MODEL=english
```

Cadence's AI routes also need your Supabase settings and a signed-in account, even locally.

`TRIAGE_MODEL=english` matters when the server only has some checkpoints: Laya otherwise routes non-English text
to its multilingual checkpoint and answers `500` if that one is not there. Leave it unset if you bake `all`.

## 2. Build the image in Google Cloud

You need a Google Cloud project with billing enabled (the free tier still needs it). Then, once:

```bash
gcloud config set project <your project id>
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create laya --repository-format=docker --location=us-central1
printf '%s' "$(openssl rand -hex 32)" | gcloud secrets create laya-api-key --data-file=-
```

Build and push (Cloud Build has a free daily allowance of build minutes):

```bash
gcloud builds submit --no-source --config deploy/laya/cloudbuild.yaml
```

Set `_MODELS` to bake more (`--substitutions=_MODELS="english multilingual"`), and `_LAYA_REF` to pin a Laya tag.

## 3. Deploy to Cloud Run

```bash
PROJECT=$(gcloud config get-value project)
gcloud run deploy laya \
  --image us-central1-docker.pkg.dev/$PROJECT/laya/laya:latest \
  --region us-central1 --port 8000 \
  --args=laya-serve \
  --memory 4Gi --cpu 2 --concurrency 4 --max-instances 1 --timeout 60 \
  --allow-unauthenticated \
  --set-env-vars LAYA_MODELS=english,HF_HUB_OFFLINE=1 \
  --set-secrets LAYA_API_KEY=laya-api-key:latest
```

- `--allow-unauthenticated` only opens the URL; Laya itself still demands the bearer key.
- Grant the Cloud Run service account access to the secret if the deploy says it cannot read it
  (`gcloud secrets add-iam-policy-binding laya-api-key --member=serviceAccount:<run service account> --role=roles/secretmanager.secretAccessor`).
- Resize `--memory` from your step 1 measurement. Cloud Run's free allowance is counted in GiB-seconds, so a
  bigger instance gives fewer free hours a month. Scale to zero means no cost while it is idle.
- The first request after idle loads the model, which can take longer than Cadence waits. That Tidy falls back to
  Claude; the next one uses Laya.

The deploy prints a URL. Check it:

```bash
curl https://<service url>/health
```

## 4. Tell Cadence

In Vercel's project settings add, then redeploy:

```
TRIAGE_BASE_URL=https://<service url>
TRIAGE_API_KEY=<the value stored in the laya-api-key secret>
TRIAGE_MODEL=english
```

Read the key back with `gcloud secrets versions access latest --secret=laya-api-key`.

To confirm Laya is answering rather than Claude, open the Cloud Run service's logs and look for `POST /v1/systemone`
after pressing Tidy.

Cadence waits at most 8 seconds per item and 12 seconds for the whole batch, then lets Claude cover anything
Laya did not answer.

## Cleaning up

```bash
gcloud run services delete laya --region us-central1
gcloud artifacts repositories delete laya --location us-central1
gcloud secrets delete laya-api-key
```
