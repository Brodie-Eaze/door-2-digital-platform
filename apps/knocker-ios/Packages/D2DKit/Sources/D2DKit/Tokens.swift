//
//  Tokens.swift
//  D2DKit
//
//  Design tokens mirroring @d2d/ui-tokens / EazePay Intelligence palette.
//  Pure SwiftUI Color values — no glass, no aurora, navy + light-blue scale.
//

import SwiftUI

public enum D2DColor {
    public static let paper       = Color(hex: 0xF7F8FA)
    public static let surface     = Color(hex: 0xFFFFFF)
    public static let ink         = Color(hex: 0x0F172A)
    public static let ink2        = Color(hex: 0x1E293B)
    public static let muted       = Color(hex: 0x475569)
    public static let soft        = Color(hex: 0x94A3B8)
    public static let line        = Color(hex: 0xE2E8F0)
    public static let line2       = Color(hex: 0xEEF1F5)
    public static let accent      = Color(hex: 0x3B82F6)
    public static let accentSoft  = Color(hex: 0xDBEAFE)
    public static let success     = Color(hex: 0x1D4ED8)
    public static let successSoft = Color(hex: 0xDBEAFE)
    public static let warn        = Color(hex: 0x475569)
    public static let warnSoft    = Color(hex: 0xEEF1F5)
    public static let danger      = Color(hex: 0x0F172A)
    public static let dangerSoft  = Color(hex: 0xE2E8F0)
}

public enum D2DSpacing {
    public static let xs: CGFloat = 4
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 16
    public static let lg: CGFloat = 24
    public static let xl: CGFloat = 32
    public static let xxl: CGFloat = 48
}

public enum D2DRadius {
    public static let sm: CGFloat = 8
    public static let md: CGFloat = 10
    public static let lg: CGFloat = 12
    public static let xl: CGFloat = 16
}

extension Color {
    init(hex: UInt32, alpha: Double = 1.0) {
        let r = Double((hex >> 16) & 0xFF) / 255.0
        let g = Double((hex >> 8) & 0xFF) / 255.0
        let b = Double(hex & 0xFF) / 255.0
        self.init(.sRGB, red: r, green: g, blue: b, opacity: alpha)
    }
}
