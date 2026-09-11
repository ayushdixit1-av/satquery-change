import argparse
import os

import numpy as np
import torch
from PIL import Image

from model import T1T2ChangeDetector

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)


def load_image(path, size, mean, std):
    img = Image.open(path).convert("RGB").resize((size, size), Image.BILINEAR)
    arr = np.asarray(img, dtype=np.float32) / 255.0
    arr = (arr - np.array(mean, dtype=np.float32)) / np.array(std, dtype=np.float32)
    x = torch.from_numpy(arr.transpose(2, 0, 1)).unsqueeze(0)
    return x


def main():
    ap = argparse.ArgumentParser(description="T1T2 change detection inference")
    ap.add_argument("t1", help="path to earlier image (T1)")
    ap.add_argument("t2", help="path to later image (T2)")
    ap.add_argument("--out", default="change_map.png", help="output change-map path")
    ap.add_argument("--ckpt", default="t1t2_change_best.pth", help="checkpoint path")
    ap.add_argument("--size", type=int, default=512, help="resize to square size")
    ap.add_argument(
        "--norm",
        choices=["imagenet", "0to1"],
        default="imagenet",
        help="input normalization",
    )
    ap.add_argument("--mask", action="store_true", help="also save binary mask")
    ap.add_argument("--threshold", type=float, default=0.5, help="binary threshold")
    args = ap.parse_args()

    if args.norm == "imagenet":
        mean, std = IMAGENET_MEAN, IMAGENET_STD
    else:
        mean, std = (0.0, 0.0, 0.0), (1.0, 1.0, 1.0)

    ckpt = torch.load(args.ckpt, map_location="cpu", weights_only=False)
    model = T1T2ChangeDetector()
    model.load_state_dict(ckpt["model_state_dict"], strict=True)
    model.eval()

    t1 = load_image(args.t1, args.size, mean, std)
    t2 = load_image(args.t2, args.size, mean, std)

    with torch.no_grad():
        prob = model(t1, t2)[0, 0].numpy()

    prob_img = (prob * 255).astype(np.uint8)
    Image.fromarray(prob_img, mode="L").save(args.out)
    print(f"probability map saved -> {args.out}  ({100 * prob.mean():.1f}% changed)")

    if args.mask:
        mask = (prob > args.threshold).astype(np.uint8) * 255
        mask_path = os.path.splitext(args.out)[0] + "_mask.png"
        Image.fromarray(mask, mode="L").save(mask_path)
        print(f"binary mask saved -> {mask_path}")


if __name__ == "__main__":
    main()