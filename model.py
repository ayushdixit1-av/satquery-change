import torch
import torch.nn as nn


def conv_block(in_ch, out_ch):
    return nn.Sequential(
        nn.Conv2d(in_ch, out_ch, kernel_size=3, padding=1, bias=False),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
        nn.Conv2d(out_ch, out_ch, kernel_size=3, padding=1, bias=False),
        nn.BatchNorm2d(out_ch),
        nn.ReLU(inplace=True),
    )


class _Block(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = conv_block(in_ch, out_ch)

    def forward(self, x):
        return self.block(x)


class Encoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.enc1 = _Block(3, 32)
        self.enc2 = _Block(32, 64)
        self.enc3 = _Block(64, 128)
        self.enc4 = _Block(128, 256)
        self.pool = nn.MaxPool2d(kernel_size=2, stride=2)

    def forward(self, x):
        feats = []
        for enc in (self.enc1, self.enc2, self.enc3, self.enc4):
            x = enc(x)
            feats.append(x)
            x = self.pool(x)
        return feats


class Fusion(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.fusion = conv_block(in_ch, out_ch)

    def forward(self, f1, f2):
        x = torch.cat([f1, f2, f1 - f2, f1 * f2], dim=1)
        return self.fusion(x)


class Decoder(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.conv = _Block(in_ch, out_ch)

    def forward(self, x):
        return self.conv(x)


class T1T2ChangeDetector(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = Encoder()
        self.fusion1 = Fusion(128, 32)
        self.fusion2 = Fusion(256, 64)
        self.fusion3 = Fusion(512, 128)
        self.fusion4 = Fusion(1024, 256)
        self.decoder3 = Decoder(384, 128)
        self.decoder2 = Decoder(192, 64)
        self.decoder1 = Decoder(96, 32)
        self.refine = nn.Sequential(
            nn.Conv2d(32, 16, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(16),
            nn.ReLU(inplace=True),
            nn.Conv2d(16, 8, kernel_size=3, padding=1, bias=False),
            nn.BatchNorm2d(8),
            nn.ReLU(inplace=True),
        )
        self.change_head = nn.Conv2d(8, 1, kernel_size=1, bias=True)
        self.upsample = nn.Upsample(scale_factor=2, mode="bilinear", align_corners=False)

    def forward(self, t1, t2):
        e1 = self.encoder(t1)
        e2 = self.encoder(t2)

        f1 = self.fusion1(e1[0], e2[0])
        f2 = self.fusion2(e1[1], e2[1])
        f3 = self.fusion3(e1[2], e2[2])
        f4 = self.fusion4(e1[3], e2[3])

        d3 = self.decoder3(torch.cat([self.upsample(f4), f3], dim=1))
        d2 = self.decoder2(torch.cat([self.upsample(d3), f2], dim=1))
        d1 = self.decoder1(torch.cat([self.upsample(d2), f1], dim=1))

        x = self.refine(d1)
        out = self.change_head(x)
        return torch.sigmoid(out)