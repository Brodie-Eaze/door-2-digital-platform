//
//  StatusPill.swift
//  D2DKit
//
//  Status badge mirroring @d2d/ui-web StatusPill.tsx.
//

import SwiftUI

public enum D2DTone {
    case success, warn, danger, info, muted

    var background: Color {
        switch self {
        case .success: D2DColor.successSoft
        case .warn:    D2DColor.warnSoft
        case .danger:  D2DColor.dangerSoft
        case .info:    D2DColor.accentSoft
        case .muted:   D2DColor.line2
        }
    }

    var foreground: Color {
        switch self {
        case .success: D2DColor.success
        case .warn:    D2DColor.warn
        case .danger:  D2DColor.danger
        case .info:    D2DColor.accent
        case .muted:   D2DColor.muted
        }
    }
}

public struct D2DStatusPill: View {
    private let label: String
    private let tone: D2DTone

    public init(_ label: String, tone: D2DTone = .muted) {
        self.label = label
        self.tone = tone
    }

    public var body: some View {
        Text(label)
            .font(.system(size: 11, weight: .medium))
            .tracking(-0.1)
            .foregroundStyle(tone.foreground)
            .padding(.horizontal, 8)
            .padding(.vertical, 2)
            .background(tone.background)
            .clipShape(RoundedRectangle(cornerRadius: 6))
    }
}
