// DailyGoalRing.swift — circular daily-goal progress ring + streak card for the "Me" screen.

import SwiftUI

/// Self-contained card showing today's knock progress against a daily goal
/// as a circular ring, alongside a streak indicator and remaining-to-goal count.
///
/// Usage: `DailyGoalRing(knocksToday: appState.knocksToday)`
struct DailyGoalRing: View {
    let knocksToday: Int
    let goal: Int
    let streakDays: Int

    init(knocksToday: Int, goal: Int = 80, streakDays: Int = 0) {
        self.knocksToday = knocksToday
        self.goal = max(0, goal)
        self.streakDays = max(0, streakDays)
    }

    /// Drives the breathing animation on the active streak flame + ring glow.
    @State private var flameAlive = false

    // MARK: - Derived

    /// Clamped 0...1 progress fraction. Guards against goal == 0.
    private var progress: Double {
        guard goal > 0 else { return 0 }
        return min(1.0, max(0.0, Double(knocksToday) / Double(goal)))
    }

    private var remaining: Int { max(0, goal - knocksToday) }
    private var goalReached: Bool { knocksToday >= goal && goal > 0 }

    private var streakLabel: String {
        streakDays == 1 ? "1 day streak" : "\(streakDays) day streak"
    }

    private var remainingLabel: String {
        goalReached ? "Goal reached" : "\(remaining) to goal"
    }

    // MARK: - Body

    var body: some View {
        HStack(spacing: D2DSpacing.lg) {
            ring
                .frame(width: 116, height: 116)

            VStack(alignment: .leading, spacing: D2DSpacing.sm) {
                Text("DAILY GOAL")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(D2DColor.soft)
                    .tracking(0.4)

                // Streak indicator — flame breathes when the streak is alive
                HStack(spacing: 6) {
                    Image(systemName: "flame.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(streakDays > 0 ? D2DColor.accent : D2DColor.soft)
                        .scaleEffect(streakDays > 0 && flameAlive ? 1.18 : 1.0, anchor: .bottom)
                        .opacity(streakDays > 0 && flameAlive ? 1.0 : (streakDays > 0 ? 0.82 : 1.0))
                        .animation(
                            streakDays > 0
                                ? .easeInOut(duration: 0.85).repeatForever(autoreverses: true)
                                : .default,
                            value: flameAlive
                        )
                    Text(streakLabel)
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(D2DColor.ink)
                        .monospacedDigit()
                }

                // Remaining to goal
                HStack(spacing: 6) {
                    Image(systemName: goalReached ? "checkmark.circle.fill" : "target")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(goalReached ? D2DColor.success : D2DColor.muted)
                    Text(remainingLabel)
                        .font(.system(size: 14, weight: .medium))
                        .foregroundStyle(D2DColor.muted)
                        .monospacedDigit()
                }

                D2DStatusPill(
                    label: "\(Int((progress * 100).rounded()))% of \(goal)",
                    tone: goalReached ? .success : .info
                )
                .padding(.top, 2)
            }

            Spacer(minLength: 0)
        }
        .padding(D2DSpacing.md)
        .background(D2DColor.surface)
        .clipShape(RoundedRectangle(cornerRadius: D2DRadius.lg))
        .overlay(
            RoundedRectangle(cornerRadius: D2DRadius.lg)
                .strokeBorder(D2DColor.line2, lineWidth: 1)
        )
        .shadow(color: D2DColor.ink.opacity(0.04), radius: 2, y: 1)
        .onAppear { flameAlive = true }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Daily goal. \(knocksToday) of \(goal) knocks. \(remainingLabel). \(streakLabel)."
        )
    }

    // MARK: - Ring

    private var ring: some View {
        ZStack {
            // Track
            Circle()
                .stroke(D2DColor.line, lineWidth: ringWidth)

            // Progress arc — smooth spring fill, gentle glow on completion
            Circle()
                .trim(from: 0, to: CGFloat(progress))
                .stroke(
                    goalReached ? D2DColor.success : D2DColor.accent,
                    style: StrokeStyle(lineWidth: ringWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
                .shadow(
                    color: (goalReached ? D2DColor.success : D2DColor.accent)
                        .opacity(goalReached ? 0.45 : 0.0),
                    radius: 5
                )
                .animation(.spring(response: 0.7, dampingFraction: 0.78), value: progress)
                .animation(.easeOut(duration: 0.4), value: goalReached)

            // Center value
            VStack(spacing: 0) {
                HStack(alignment: .firstTextBaseline, spacing: 1) {
                    Text("\(knocksToday)")
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(D2DColor.ink)
                        .monospacedDigit()
                    Text("/\(goal)")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundStyle(D2DColor.soft)
                        .monospacedDigit()
                }
                .lineLimit(1)
                .minimumScaleFactor(0.7)

                Text("knocks")
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(D2DColor.muted)
                    .tracking(0.3)
            }
            .padding(.horizontal, 6)
        }
    }

    private let ringWidth: CGFloat = 11
}

// MARK: - Preview

#Preview {
    VStack(spacing: 16) {
        DailyGoalRing(knocksToday: 52, goal: 80, streakDays: 4)
        DailyGoalRing(knocksToday: 80, goal: 80, streakDays: 12)
        DailyGoalRing(knocksToday: 0, goal: 80, streakDays: 0)
    }
    .padding()
    .background(D2DColor.paper)
}
