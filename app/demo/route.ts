// Port of public/demo.php, which emits a single raw line of text (an FTP deploy
// test) and no HTML/head at all:
//
//   echo "FTP deploy test successful - " . date('Y-m-d H:i:s');
//
// Kept as a text/plain route so the response is byte-for-byte the same shape.
export async function GET() {
  return new Response(`FTP deploy test successful - ${new Date().toISOString().slice(0, 19).replace("T", " ")}`, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
