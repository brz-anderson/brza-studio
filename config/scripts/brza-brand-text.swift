// brza-brand-text.swift - Geist text as paths, through CoreText (PLN-007, D3).
// Usage: swift brza-brand-text.swift <woff2> <wght> <tracking-em> <text>
// Prints JSON {advance, capHeight, d, glyphs}: everything in px of a 100 px font, baseline at y = 0 and y pointing
// down (SVG). `d` is the whole line; `glyphs` has each glyph's path, to paint one of them apart.
// `advance` leaves out the tracking after the last glyph, so the text centers without a gap.
// Tracking 0 turns pair kerning off (CoreText reads a zero `kCTKernAttributeName` that way): "BrzA" at 100 px in 750
// gives 246.91, the sum of the advances, and is the script's proof. With a nonzero tracking the kerning applies, as in live text.
import CoreText
import Foundation

func fail(_ message: String) -> Never {
  FileHandle.standardError.write((message + "\n").data(using: .utf8)!)
  exit(1)
}

let args = CommandLine.arguments
guard args.count == 5, let wght = Double(args[2]), let tracking = Double(args[3]) else {
  fail("usage: swift brza-brand-text.swift <woff2> <wght> <tracking-em> <text>")
}
guard let data = try? Data(contentsOf: URL(fileURLWithPath: args[1])) else { fail("could not read \(args[1])") }
guard let descs = CTFontManagerCreateFontDescriptorsFromData(data as CFData) as? [CTFontDescriptor], let desc = descs.first
else { fail("CoreText could not read the font \(args[1])") }

let size: CGFloat = 100
let wghtTag = 0x7767_6874  // 'wght'
let varied = CTFontDescriptorCreateCopyWithAttributes(desc, [kCTFontVariationAttribute: [wghtTag: wght]] as CFDictionary)
let font = CTFontCreateWithFontDescriptor(varied, size, nil)

let attrs: [NSAttributedString.Key: Any] = [
  NSAttributedString.Key(kCTFontAttributeName as String): font,
  NSAttributedString.Key(kCTKernAttributeName as String): CGFloat(tracking) * size,
]
let line = CTLineCreateWithAttributedString(NSAttributedString(string: args[4], attributes: attrs))

func f(_ v: CGFloat) -> String { String(format: "%.2f", Double(v)) }

func svgPath(_ path: CGPath, dx: CGFloat) -> String {
  var out = ""
  path.applyWithBlock { element in
    let e = element.pointee
    let p = e.points
    switch e.type {
    case .moveToPoint: out += "M\(f(p[0].x + dx)) \(f(-p[0].y))"
    case .addLineToPoint: out += "L\(f(p[0].x + dx)) \(f(-p[0].y))"
    case .addQuadCurveToPoint:
      out += "Q\(f(p[0].x + dx)) \(f(-p[0].y)) \(f(p[1].x + dx)) \(f(-p[1].y))"
    case .addCurveToPoint:
      out += "C\(f(p[0].x + dx)) \(f(-p[0].y)) \(f(p[1].x + dx)) \(f(-p[1].y)) \(f(p[2].x + dx)) \(f(-p[2].y))"
    case .closeSubpath: out += "Z"
    @unknown default: break
    }
  }
  return out
}

var glyphPaths: [String] = []
var advance: CGFloat = 0
for run in CTLineGetGlyphRuns(line) as! [CTRun] {
  let n = CTRunGetGlyphCount(run)
  var glyphs = [CGGlyph](repeating: 0, count: n)
  var positions = [CGPoint](repeating: .zero, count: n)
  CTRunGetGlyphs(run, CFRange(location: 0, length: 0), &glyphs)
  CTRunGetPositions(run, CFRange(location: 0, length: 0), &positions)
  let runAttrs = CTRunGetAttributes(run) as NSDictionary
  let runFont = runAttrs[kCTFontAttributeName as String] as! CTFont
  var advances = [CGSize](repeating: .zero, count: n)
  CTFontGetAdvancesForGlyphs(runFont, .horizontal, glyphs, &advances, n)
  for i in 0..<n {
    if let path = CTFontCreatePathForGlyph(runFont, glyphs[i], nil) {
      glyphPaths.append(svgPath(path, dx: positions[i].x))
    } else {
      glyphPaths.append("")
    }
    advance = max(advance, positions[i].x + advances[i].width)
  }
}

let result: [String: Any] = [
  "advance": (Double(advance) * 100).rounded() / 100,
  "capHeight": (Double(CTFontGetCapHeight(font)) * 100).rounded() / 100,
  "d": glyphPaths.joined(),
  "glyphs": glyphPaths,
]
let json = try! JSONSerialization.data(withJSONObject: result, options: [.sortedKeys])
print(String(data: json, encoding: .utf8)!)
