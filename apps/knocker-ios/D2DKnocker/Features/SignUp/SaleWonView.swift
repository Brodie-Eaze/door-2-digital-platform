// SaleWonView.swift — the win moment. Shown after a SALE is completed.
// On-brand celebration (navy + light-blue, no emojis, no confetti library):
// a spring-in success seal with an SF Symbol bounce, the deal echoed back,
// an optional commission line, and a full-width Done button.

import SwiftUI

struct SaleWonView: View {
    let customerName: String
    let serviceName: String
    let amountLabel: String
    let commissionLabel: String?
    let onDone: () -> Void

    @State private var sealVisible = false
    @State private var bounce = 0
    @State private var glowVisible = false
    @State private var copyVisible = false

    var body: some View {
        VStack(spacing: 0) {
            Spacer(minLength: D2DSpacing.xl)

            // MARK: Success seal with radial accent glow
            ZStack {
                // Subtle radial accent glow — pure SwiftUI shapes, no library.
                Circle()
                    .fill(
                        RadialGradient(
                            colors: [D2DColor.accent.opacity(0.22), D2DColor.accent.opacity(0.0)],
                            center: .center,
                            startRadius: 8,
                            endRadius: 150
                        )
                    )
                    .frame(width: 300, height: 300)
                    .scaleEffect(glowVisible ? 1.0 : 0.4)
                    .opacity(glowVisible ? 1.0 : 0.0)

                // Outer ring halo
                Circle()
                    .fill(D2DColor.accentSoft)
                    .frame(width: 132, height: 132)
                    .opacity(sealVisible ? 1.0 : 0.0)

                // Navy seal
                Circle()
                    .fill(D2DColor.hero)
                    .frame(width: 104, height: 104)
                    .overlay(
                        Circle().strokeBorder(D2DColor.accent.opacity(0.35), lineWidth: 1.5)
                    )
                    .shadow(color: D2DColor.hero.opacity(0.25), radius: 16, y: 8)

                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 52, weight: .bold))
                    .foregroundStyle(.white)
                    .symbolEffect(.bounce, value: bounce)
            }
            .scaleEffect(sealVisible ? 1.0 : 0.5)
            .opacity(sealVisible ? 1.0 : 0.0)

            Spacer(minLength: D2DSpacing.lg)

            // MARK: Headline + deal echo
            VStack(spacing: D2DSpacing.sm) {
                Text("Signed up!")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundStyle(D2DColor.ink)

                Text(customerName)
                    .font(.system(size: 19, weight: .semibold))
                    .foregroundStyle(D2DColor.ink2)
                    .multilineTextAlignment(.center)

                HStack(spacing: 8) {
                    Text(serviceName)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(D2DColor.muted)
                    Circle()
                        .fill(D2DColor.soft)
                        .frame(width: 3, height: 3)
                    Text(amountLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                        .monospacedDigit()
                }
                .padding(.top, 2)

                if let commissionLabel {
                    HStack(spacing: 6) {
                        Image(systemName: "sparkles")
                            .font(.system(size: 13, weight: .semibold))
                        Text("You earned \(commissionLabel)")
                            .font(.system(size: 15, weight: .bold))
                            .monospacedDigit()
                    }
                    .foregroundStyle(D2DColor.accent)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(D2DColor.accentSoft, in: Capsule())
                    .padding(.top, D2DSpacing.sm)
                }
            }
            .multilineTextAlignment(.center)
            .padding(.horizontal, D2DSpacing.lg)
            .opacity(copyVisible ? 1.0 : 0.0)
            .offset(y: copyVisible ? 0 : 12)

            Spacer(minLength: D2DSpacing.xl)

            // MARK: Done button
            Button(action: onDone) {
                Text("Done")
                    .font(.system(size: 17, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 15)
                    .background(D2DColor.hero, in: RoundedRectangle(cornerRadius: D2DRadius.lg))
            }
            .buttonStyle(.plain)
            .padding(.horizontal, D2DSpacing.md)
            .padding(.bottom, D2DSpacing.lg)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(D2DColor.paper)
        .onAppear(perform: runSequence)
    }

    private func runSequence() {
        withAnimation(.spring(response: 0.5, dampingFraction: 0.55)) {
            sealVisible = true
        }
        withAnimation(.easeOut(duration: 0.7)) {
            glowVisible = true
        }
        withAnimation(.easeOut(duration: 0.4).delay(0.18)) {
            copyVisible = true
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) {
            bounce += 1
        }
    }
}

#Preview("With commission") {
    SaleWonView(
        customerName: "Marcus Bellweather",
        serviceName: "Premium Pest Control",
        amountLabel: "$149/mo",
        commissionLabel: "$74.50",
        onDone: {}
    )
}

#Preview("No commission") {
    SaleWonView(
        customerName: "The Okafor Household",
        serviceName: "Quarterly Plan",
        amountLabel: "$89/qtr",
        commissionLabel: nil,
        onDone: {}
    )
}
