// SignaturePadView.swift — freehand signature capture via Canvas.
// Persists strokes as [[CGPoint]]; caller renders final image for upload.

import SwiftUI

struct SignaturePadView: View {
    @Binding var lines: [[CGPoint]]
    let onProceed: () -> Void

    @State private var currentLine: [CGPoint] = []

    var hasSignature: Bool { !lines.isEmpty }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Signature required")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(D2DColor.ink)
                    Text("Sign to confirm consent and agreement")
                        .font(.system(size: 12))
                        .foregroundStyle(D2DColor.muted)
                }
                Spacer()
                if hasSignature {
                    Button {
                        withAnimation { lines = []; currentLine = [] }
                    } label: {
                        Label("Clear", systemImage: "arrow.counterclockwise")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundStyle(D2DColor.danger)
                            .labelStyle(.titleAndIcon)
                    }
                }
            }

            // Signature canvas
            ZStack(alignment: .bottomLeading) {
                // Background
                RoundedRectangle(cornerRadius: D2DRadius.md)
                    .fill(Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: D2DRadius.md)
                            .strokeBorder(hasSignature ? D2DColor.accent.opacity(0.4) : D2DColor.line, lineWidth: 1.5)
                    )

                // Baseline
                Rectangle()
                    .fill(D2DColor.line)
                    .frame(height: 1)
                    .padding(.horizontal, 24)
                    .padding(.bottom, 24)

                // "Sign here" hint
                if !hasSignature && currentLine.isEmpty {
                    HStack(spacing: 6) {
                        Image(systemName: "pencil.tip")
                            .foregroundStyle(D2DColor.soft)
                        Text("Sign here")
                            .foregroundStyle(D2DColor.soft)
                    }
                    .font(.system(size: 14))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                }

                // Draw committed lines
                Canvas { context, _ in
                    for line in lines {
                        drawLine(context: context, points: line)
                    }
                    drawLine(context: context, points: currentLine)
                }
                .clipShape(RoundedRectangle(cornerRadius: D2DRadius.md))

                // Gesture capture overlay
                Color.clear
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0, coordinateSpace: .local)
                            .onChanged { value in
                                currentLine.append(value.location)
                            }
                            .onEnded { _ in
                                if !currentLine.isEmpty {
                                    lines.append(currentLine)
                                    currentLine = []
                                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                                }
                            }
                    )
            }
            .frame(height: 160)

            // Proceed button
            Button(action: onProceed) {
                Text(hasSignature ? "Save Knock" : "Skip & Save")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 50)
                    .background(
                        hasSignature ? D2DColor.accent : D2DColor.soft,
                        in: RoundedRectangle(cornerRadius: D2DRadius.md)
                    )
            }

            if !hasSignature {
                Text("You can skip the signature, but consent will not be verified")
                    .font(.system(size: 11))
                    .foregroundStyle(D2DColor.muted)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
        }
    }

    // MARK: - Drawing

    private func drawLine(context: GraphicsContext, points: [CGPoint]) {
        guard points.count >= 2 else { return }
        var path = Path()
        path.move(to: points[0])
        for i in 1..<points.count {
            let mid = CGPoint(
                x: (points[i - 1].x + points[i].x) / 2,
                y: (points[i - 1].y + points[i].y) / 2
            )
            path.addQuadCurve(to: mid, control: points[i - 1])
        }
        path.addLine(to: points[points.count - 1])
        context.stroke(
            path,
            with: .color(D2DColor.ink),
            style: StrokeStyle(lineWidth: 2.5, lineCap: .round, lineJoin: .round)
        )
    }
}

// MARK: - Signature rendering to UIImage

extension SignaturePadView {
    static func renderToImage(lines: [[CGPoint]], size: CGSize = CGSize(width: 600, height: 300)) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))

            UIColor.black.setStroke()
            ctx.cgContext.setLineWidth(2.5)
            ctx.cgContext.setLineCap(.round)
            ctx.cgContext.setLineJoin(.round)

            for line in lines {
                guard line.count >= 2 else { continue }
                ctx.cgContext.beginPath()
                ctx.cgContext.move(to: line[0])
                for i in 1..<line.count {
                    ctx.cgContext.addLine(to: line[i])
                }
                ctx.cgContext.strokePath()
            }
        }
    }
}
