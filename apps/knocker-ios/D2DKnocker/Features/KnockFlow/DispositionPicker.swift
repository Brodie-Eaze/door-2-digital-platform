// DispositionPicker.swift — 3×2 disposition grid.
// Big colored tap targets matching the marketing mockup:
// SALE / LEAD / NOT HOME · CALLBACK / REFUSED / DNC. Haptic on selection.

import SwiftUI

struct DispositionPicker: View {
    @Binding var selected: KnockDisposition?
    let onSelect: (KnockDisposition) -> Void
    /// The headline conversion tile is org-configurable: a charity sees "DONOR"
    /// (records a donation), a commercial org sees "SALE" (records a sale).
    var saleLabel: String = "SALE"
    var saleDisposition: KnockDisposition = .convertedSale

    // Fixed 6, in mockup order, with the exact label + fill.
    private struct Tile {
        let disposition: KnockDisposition
        let label: String
        let fill: Color
        let fg: Color
        var icon: String? = nil
    }

    private var tiles: [Tile] {
        [
            Tile(disposition: saleDisposition, label: saleLabel,  fill: D2DColor.accent,        fg: .white),
            Tile(disposition: .appointment,   label: "LEAD",      fill: Color(hex: 0x60A5FA),   fg: .white),
            Tile(disposition: .noAnswer,      label: "NOT\nHOME", fill: Color(hex: 0x64748B),   fg: .white),
            Tile(disposition: .callback,      label: "CALLBACK",  fill: D2DColor.hero,          fg: .white),
            Tile(disposition: .notInterested, label: "REFUSED",   fill: Color(hex: 0xE2E8F0),   fg: D2DColor.ink),
            // DNC = permanent legal "never knock here again": darkest tile + a
            // nosign glyph so it can't be confused with the navy CALLBACK beside it.
            Tile(disposition: .doNotKnock,    label: "DNC",       fill: Color(hex: 0x0B1220),   fg: .white, icon: "nosign"),
        ]
    }

    var body: some View {
        let columns = [
            GridItem(.flexible(), spacing: 10),
            GridItem(.flexible(), spacing: 10),
            GridItem(.flexible(), spacing: 10),
        ]
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(tiles, id: \.disposition) { tile in
                tileButton(tile)
            }
        }
    }

    private func tileButton(_ tile: Tile) -> some View {
        let isSelected = selected == tile.disposition
        return Button {
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            selected = tile.disposition
            onSelect(tile.disposition)
        } label: {
            VStack(spacing: 4) {
                if let icon = tile.icon {
                    Image(systemName: icon).font(.system(size: 15, weight: .bold))
                }
                Text(tile.label)
                    .font(.system(size: 15, weight: .bold))
                    .multilineTextAlignment(.center)
            }
                .foregroundStyle(tile.fg)
                .frame(maxWidth: .infinity)
                .frame(height: 84)
                .background(tile.fill, in: RoundedRectangle(cornerRadius: 14))
                .overlay(
                    RoundedRectangle(cornerRadius: 14)
                        .strokeBorder(D2DColor.ink, lineWidth: isSelected ? 2.5 : 0)
                )
                .overlay(alignment: .topTrailing) {
                    if isSelected {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.system(size: 18))
                            .foregroundStyle(.white, D2DColor.ink)
                            .padding(6)
                    }
                }
                .scaleEffect(isSelected ? 0.97 : 1)
                .animation(.spring(duration: 0.2), value: isSelected)
        }
        // VoiceOver reads the disposition name ("Do not knock"), not the raw
        // multi-line tile label ("NOT\nHOME").
        .accessibilityLabel(tile.disposition.displayName)
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

// MARK: - KnockDisposition display extensions (used by the saved-knock view)

extension KnockDisposition {
    var displayName: String {
        switch self {
        case .noAnswer:          return "Not home"
        case .notInterested:     return "Refused"
        case .callback:          return "Callback"
        case .doNotKnock:        return "Do not knock"
        case .appointment:       return "Lead"
        case .convertedSale:     return "Sale"
        case .convertedDonation: return "Donation"
        case .hostile:           return "Hostile"
        case .invalidAddress:    return "Bad address"
        }
    }
}

#Preview {
    DispositionPicker(selected: .constant(.convertedSale), onSelect: { _ in })
        .padding()
}
