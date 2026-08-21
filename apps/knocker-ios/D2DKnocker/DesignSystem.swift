// DesignSystem.swift — inline design tokens for the D2DKnocker app target.
// Mirrors the @d2d/ui-tokens web palette so the iOS app stays visually
// consistent with the operator console and web-org surfaces.
// The D2DKit local package in Packages/D2DKit provides the same values —
// add D2DKit as a local Swift Package dependency to remove this file.

import SwiftUI

// MARK: - Colors

enum D2DColor {
    // Backgrounds
    static let paper    = Color(hex: 0xF7F8FA)
    static let surface  = Color(hex: 0xFFFFFF)
    // Text
    static let ink      = Color(hex: 0x0F172A)
    static let ink2     = Color(hex: 0x1E293B)
    static let muted    = Color(hex: 0x475569)
    static let soft     = Color(hex: 0x94A3B8)
    // Borders
    static let line     = Color(hex: 0xE2E8F0)
    static let line2    = Color(hex: 0xEEF1F5)
    // Accent (primary blue)
    static let accent     = Color(hex: 0x3B82F6)
    static let accentSoft = Color(hex: 0xDBEAFE)
    // Hero (dark navy surfaces — sidebar, phone frame)
    static let hero     = Color(hex: 0x0F172A)
    static let heroLine = Color(hex: 0x1E293B)
    // Status — ALL shades of navy/blue. No traffic-light colors.
    // success = dark blue (not green), warn = slate (not amber), danger = near-black (not red)
    // This is the D2D design invariant: monochromatic navy + blue palette throughout.
    static let success     = Color(hex: 0x1D4ED8)  // dark blue
    static let successSoft = Color(hex: 0xDBEAFE)  // same as accentSoft
    static let warn        = Color(hex: 0x475569)  // slate — same as muted
    static let warnSoft    = Color(hex: 0xEEF1F5)  // same as line2
    static let danger      = Color(hex: 0x0F172A)  // near-black navy — same as ink
    static let dangerSoft  = Color(hex: 0xE2E8F0)  // same as line
}

// MARK: - Spacing

enum D2DSpacing {
    static let xs: CGFloat =  4
    static let sm: CGFloat =  8
    static let md: CGFloat = 16
    static let lg: CGFloat = 24
    static let xl: CGFloat = 32
    static let xxl: CGFloat = 48
}

// MARK: - Corner Radius

enum D2DRadius {
    static let sm: CGFloat =  8
    static let md: CGFloat = 10
    static let lg: CGFloat = 12
    static let xl: CGFloat = 16
    static let pill: CGFloat = 999
}

// MARK: - Color from hex

extension Color {
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >>  8) & 0xFF) / 255.0
        let b = Double((hex      ) & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}

// MARK: - Card

struct D2DCard<Content: View>: View {
    let padded: Bool
    let content: Content

    init(padded: Bool = true, @ViewBuilder content: () -> Content) {
        self.padded = padded
        self.content = content()
    }

    var body: some View {
        content
            .if(padded) { $0.padding(D2DSpacing.md) }
            .background(D2DColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: D2DRadius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: D2DRadius.lg)
                    .strokeBorder(D2DColor.line2, lineWidth: 1)
            )
            .shadow(color: D2DColor.ink.opacity(0.04), radius: 2, y: 1)
    }
}

// MARK: - Status Pill

struct D2DStatusPill: View {
    enum Tone { case success, warn, danger, info, muted }
    let label: String
    let tone: Tone

    var body: some View {
        Text(label)
            .font(.system(size: 11, weight: .semibold))
            .foregroundStyle(fgColor)
            .padding(.horizontal, 8)
            .padding(.vertical, 3)
            .background(bgColor, in: Capsule())
    }

    private var fgColor: Color {
        switch tone {
        case .success: return D2DColor.success
        case .warn:    return D2DColor.warn
        case .danger:  return D2DColor.danger
        case .info:    return D2DColor.accent
        case .muted:   return D2DColor.muted
        }
    }
    private var bgColor: Color {
        switch tone {
        case .success: return D2DColor.successSoft
        case .warn:    return D2DColor.warnSoft
        case .danger:  return D2DColor.dangerSoft
        case .info:    return D2DColor.accentSoft
        case .muted:   return D2DColor.line2
        }
    }
}

// MARK: - View conditional modifier

extension View {
    @ViewBuilder
    func `if`<Transform: View>(_ condition: Bool, transform: (Self) -> Transform) -> some View {
        if condition { transform(self) } else { self }
    }
}

// MARK: - Section header

struct SectionHeader: View {
    let title: String
    var subtitle: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(D2DColor.ink)
            if let sub = subtitle {
                Text(sub)
                    .font(.system(size: 11))
                    .foregroundStyle(D2DColor.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, D2DSpacing.md)
        .padding(.top, D2DSpacing.md)
        .padding(.bottom, D2DSpacing.xs)
    }
}

// MARK: - KPI Card

struct KPICard: View {
    let label: String
    let value: String
    var delta: String? = nil
    var deltaPositive: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label)
                .font(.system(size: 11))
                .foregroundStyle(D2DColor.muted)
            Text(value)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundStyle(D2DColor.ink)
                .monospacedDigit()
            if let d = delta {
                Text(d)
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(deltaPositive ? D2DColor.success : D2DColor.danger)
            }
        }
        .padding(D2DSpacing.md)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(D2DColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: D2DRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: D2DRadius.lg)
                .strokeBorder(D2DColor.line2, lineWidth: 1)
        )
    }
}
