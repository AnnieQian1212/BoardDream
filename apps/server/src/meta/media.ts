import type { ModelClient } from "./client";

/**
 * Muse Image edit (POST /v1/images/edits). `images` are data URLs; the first is the image to edit,
 * later ones act as references such as the style anchor.
 * Seen on /images/generations (Oct 27): `{ data: [{ b64_json }], output_format: "webp", usage }`,
 * 1600x1600, ~14 s per image.
 * TODO(day 6): confirm edits return the same shape and decode b64_json to bytes.
 */
export async function editImage(client: ModelClient, model: string, prompt: string, images: string[]) {
  return client.post("/images/edits", { model, prompt, images: images.map((image_url) => ({ image_url })), n: 1 });
}

export interface PixelBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * SAM 3.1 box-prompt string: one object per box, using the token grammar from
 * https://dev.meta.ai/docs/sam/segmenting. Lets one request check every board cell.
 */
export function boxPrompt(boxes: readonly PixelBox[], width: number, height: number): string {
  const objects = boxes.map(
    (b, i) => `${i + 1}<|box;x1=${Math.round(b.x1)};y1=${Math.round(b.y1)};x2=${Math.round(b.x2)};y2=${Math.round(b.y2)};w=${width};h=${height}|>`,
  );
  return `<0f>${objects.join(",")}`;
}

/**
 * SAM 3.1 segmentation through the Responses API. `prompt` is a short noun phrase or a boxPrompt().
 * Returns the raw token output, found in output[0].content[0].text (there is no top-level output_text).
 * Seen (Oct 27): `<0f>0<|box;x1;y1;x2;y2;w;h;c|><|mask;x=0;y=0;c;data=325,314,!…|>,1<|box…`, where the
 * box is inclusive pixels and data starts with what looks like the box's rows,cols (325x314 for a
 * 314-wide, 325-tall box) before the one_bit payload.
 * TODO(day 6): decode masks to rasters (see /docs/sam "read segmentation output").
 */
export async function segment(client: ModelClient, model: string, imageDataUrl: string, prompt: string): Promise<string> {
  const data = (await client.post("/responses", {
    model,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageDataUrl },
        ],
      },
    ],
    metadata: { mask_encoding: "one_bit", include_confidence: "true" },
  })) as { output_text?: string; output?: { content?: { text?: string }[] }[] };
  return data.output_text ?? data.output?.flatMap((o) => o.content ?? []).map((c) => c.text ?? "").join("") ?? "";
}
