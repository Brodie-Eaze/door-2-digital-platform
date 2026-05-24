//
//  Card.swift
//  D2DKit
//
//  Surface card — white background, 12pt radius, subtle 1pt border + shadow.
//  Mirrors @d2d/ui-web Card.tsx.
//

import SwiftUI

public struct D2DCard<Content: View>: View {
    private let padded: Bool
    private let content: Content

    public init(padded: Bool = true, @ViewBuilder content: () -> Content) {
        self.padded = padded
        self.content = content()
    }

    public var body: some View {
        content
            .padding(padded ? D2DSpacing.lg : 0)
            .background(D2DColor.surface)
            .clipShape(RoundedRectangle(cornerRadius: D2DRadius.lg))
            .overlay(
                RoundedRectangle(cornerRadius: D2DRadius.lg)
                    .strokeBorder(D2DColor.line2.opacity(0.6), lineWidth: 1)
            )
            .shadow(color: D2DColor.ink.opacity(0.04), radius: 1, y: 1)
    }
}
