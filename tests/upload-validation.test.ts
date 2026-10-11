import { describe, it, expect } from "vitest";
import { scanUpload } from "@/lib/storage/upload-validation";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

describe("upload validation", () => {
  it("accepts a valid PNG", () => {
    const r = scanUpload(PNG, ["image/png", "image/jpeg"], "test", 1024);
    expect(r.safe).toBe(true);
    expect(r.mime).toBe("image/png");
  });

  it("rejects a mismatched type (PDF claimed as image-only upload)", () => {
    const r = scanUpload(PDF, ["image/png", "image/jpeg"], "test", 1024);
    expect(r.safe).toBe(false);
  });

  it("rejects a file containing an embedded PHP tag", () => {
    const evil = Buffer.concat([PNG, Buffer.from("\n<?php echo 1; ?>")]);
    const r = scanUpload(evil, ["image/png"], "test", 4096);
    expect(r.safe).toBe(false);
  });

  it("rejects a file containing <script>", () => {
    const evil = Buffer.concat([JPEG, Buffer.from("<script>alert(1)</script>")]);
    const r = scanUpload(evil, ["image/jpeg"], "test", 4096);
    expect(r.safe).toBe(false);
  });

  it("rejects oversized files", () => {
    const r = scanUpload(Buffer.alloc(2048, 1), ["image/png"], "test", 1024);
    expect(r.safe).toBe(false);
  });

  it("accepts PDF when allowed", () => {
    const r = scanUpload(PDF, ["application/pdf"], "doc", 4096);
    expect(r.safe).toBe(true);
  });
});
