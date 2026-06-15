// LoginView.swift — Premium dark, custom-branded login.
// Custom-drawn Knocker logomark (door + knock waves), territory-map grid
// backdrop, breathing glow, field icons + password reveal, press physics.

import SwiftUI
import UIKit

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = AuthViewModel()
    @FocusState private var focus: Field?
    @State private var appeared = false
    @State private var breathe = false
    @State private var showPassword = false
    @State private var showingHelp = false

    enum Field { case email, password }

    var body: some View {
        ZStack {
            // ── Background ─────────────────────────────────────────────
            Color(hex: 0x05090F).ignoresSafeArea()

            // Territory-map grid — nods to what the product actually does
            MapGridBackground()
                .ignoresSafeArea()
                .opacity(appeared ? 1 : 0)
                .animation(.easeOut(duration: 1.1), value: appeared)

            // Radial accent glow, anchored behind the logo
            RadialGradient(
                colors: [Color(hex: 0x3B82F6).opacity(breathe ? 0.22 : 0.13), .clear],
                center: .init(x: 0.5, y: 0.19),
                startRadius: 0,
                endRadius: breathe ? 320 : 260
            )
            .ignoresSafeArea()
            .animation(.easeInOut(duration: 3.4).repeatForever(autoreverses: true), value: breathe)

            // Bottom vignette for depth
            LinearGradient(
                colors: [.clear, Color(hex: 0x05090F).opacity(0.85)],
                startPoint: .center, endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // ── Logo + wordmark ────────────────────────────────────
                VStack(spacing: 24) {
                    KnockerMark()
                        .frame(width: 92, height: 92)
                        .shadow(color: Color(hex: 0x3B82F6).opacity(breathe ? 0.65 : 0.4),
                                radius: breathe ? 34 : 24, y: 12)
                        .animation(.easeInOut(duration: 3.4).repeatForever(autoreverses: true), value: breathe)
                        .scaleEffect(appeared ? 1 : 0.7)
                        .opacity(appeared ? 1 : 0)
                        .animation(.spring(response: 0.5, dampingFraction: 0.62).delay(0.05), value: appeared)

                    VStack(spacing: 7) {
                        Text("KNOCKER")
                            .font(.system(size: 32, weight: .bold))
                            .tracking(10)
                            .foregroundStyle(.white)
                        HStack(spacing: 8) {
                            line
                            Text("DOOR 2 DIGITAL")
                                .font(.system(size: 10, weight: .semibold))
                                .tracking(4)
                                .foregroundStyle(Color(hex: 0x7DA9FB))
                            line
                        }
                    }
                    .opacity(appeared ? 1 : 0)
                    .offset(y: appeared ? 0 : 12)
                    .animation(.easeOut(duration: 0.4).delay(0.2), value: appeared)
                }
                .padding(.bottom, 54)

                // ── Form ───────────────────────────────────────────────
                VStack(spacing: 12) {
                    // Email
                    HStack(spacing: 12) {
                        Image(systemName: "envelope.fill")
                            .font(.system(size: 15))
                            .foregroundStyle(focus == .email ? Color(hex: 0x60A5FA) : .white.opacity(0.32))
                            .frame(width: 18)
                        TextField(
                            "",
                            text: $viewModel.email,
                            prompt: Text("Email address").foregroundColor(.white.opacity(0.3))
                        )
                        .keyboardType(.emailAddress)
                        .textContentType(.emailAddress)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                        .focused($focus, equals: .email)
                        .submitLabel(.next)
                        .onSubmit { focus = .password }
                        .foregroundStyle(.white)
                    }
                    .darkField(active: focus == .email)

                    // Password
                    HStack(spacing: 12) {
                        Image(systemName: "lock.fill")
                            .font(.system(size: 15))
                            .foregroundStyle(focus == .password ? Color(hex: 0x60A5FA) : .white.opacity(0.32))
                            .frame(width: 18)
                        Group {
                            if showPassword {
                                TextField("", text: $viewModel.password,
                                          prompt: Text("Password").foregroundColor(.white.opacity(0.3)))
                            } else {
                                SecureField("", text: $viewModel.password,
                                            prompt: Text("Password").foregroundColor(.white.opacity(0.3)))
                            }
                        }
                        .textContentType(.password)
                        .focused($focus, equals: .password)
                        .submitLabel(.go)
                        .onSubmit { Task { await viewModel.login(appState: appState) } }
                        .foregroundStyle(.white)

                        Button { showPassword.toggle() } label: {
                            Image(systemName: showPassword ? "eye.slash.fill" : "eye.fill")
                                .font(.system(size: 14))
                                .foregroundStyle(.white.opacity(0.34))
                        }
                    }
                    .darkField(active: focus == .password)

                    // Forgot password
                    HStack {
                        Spacer()
                        Button { focus = nil; showingHelp = true } label: {
                            Text("Forgot password?")
                                .font(.system(size: 13, weight: .medium))
                                .foregroundStyle(Color(hex: 0x60A5FA))
                        }
                    }
                    .padding(.top, 2)

                    // Error
                    if let err = viewModel.errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill").font(.system(size: 13))
                            Text(err).font(.system(size: 13))
                        }
                        .foregroundStyle(Color(hex: 0xF87171))
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .transition(.opacity.combined(with: .move(edge: .top)))
                    }

                    // Sign in
                    Button {
                        focus = nil
                        Task { await viewModel.login(appState: appState) }
                    } label: {
                        ZStack {
                            LinearGradient(
                                colors: [Color(hex: 0x3B82F6), Color(hex: 0x1D4ED8)],
                                startPoint: .topLeading, endPoint: .bottomTrailing
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 15, style: .continuous))

                            if viewModel.isLoading {
                                ProgressView().tint(.white).scaleEffect(0.9)
                            } else {
                                HStack(spacing: 8) {
                                    Text("Sign in").font(.system(size: 16, weight: .semibold))
                                    Image(systemName: "arrow.right").font(.system(size: 14, weight: .semibold))
                                }
                                .foregroundStyle(.white)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .shadow(color: Color(hex: 0x3B82F6).opacity(0.45), radius: 18, y: 8)
                    }
                    .buttonStyle(PressableStyle())
                    .disabled(viewModel.isLoading)
                    .padding(.top, 6)
                }
                .padding(.horizontal, 28)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 22)
                .animation(.easeOut(duration: 0.45).delay(0.26), value: appeared)
                .animation(.easeOut(duration: 0.2), value: viewModel.errorMessage)

                // Invite-only helper — knockers are provisioned by their team
                Button { showingHelp = true } label: {
                    HStack(spacing: 5) {
                        Text("New here?").foregroundStyle(.white.opacity(0.34))
                        Text("Need help signing in")
                            .foregroundStyle(Color(hex: 0x60A5FA))
                        Image(systemName: "arrow.up.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(Color(hex: 0x60A5FA))
                    }
                    .font(.system(size: 13, weight: .medium))
                }
                .padding(.top, 18)
                .opacity(appeared ? 1 : 0)
                .animation(.easeOut(duration: 0.45).delay(0.32), value: appeared)

                Spacer()

                // ── Trust footer ───────────────────────────────────────
                VStack(spacing: 8) {
                    HStack(spacing: 6) {
                        Image(systemName: "lock.shield.fill").font(.system(size: 11))
                        Text("Encrypted in transit & on device").font(.system(size: 11, weight: .medium)).tracking(0.3)
                    }
                    .foregroundStyle(.white.opacity(0.28))

                    Text("Knocker iOS v\(Config.appVersion)")
                        .font(.system(size: 10))
                        .foregroundStyle(.white.opacity(0.14))
                }
                .padding(.bottom, 26)
                .opacity(appeared ? 1 : 0)
                .animation(.easeOut(duration: 0.5).delay(0.4), value: appeared)
            }
        }
        .onAppear { appeared = true; breathe = true }
        .sheet(isPresented: $showingHelp) {
            SignInHelpSheet(prefillEmail: viewModel.email)
                .presentationDetents([.height(440)])
                .presentationDragIndicator(.visible)
                .presentationBackground(Color(hex: 0x0A1018))
        }
    }

    private var line: some View {
        Rectangle()
            .fill(Color(hex: 0x7DA9FB).opacity(0.35))
            .frame(width: 18, height: 1)
    }
}

// MARK: - Custom logomark: door + knock waves

private struct KnockerMark: View {
    @State private var ping = false

    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(LinearGradient(colors: [Color(hex: 0x2563EB), Color(hex: 0x3B82F6)],
                                     startPoint: .topLeading, endPoint: .bottomTrailing))
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .fill(LinearGradient(colors: [.white.opacity(0.14), .clear],
                                     startPoint: .top, endPoint: .center))
            RoundedRectangle(cornerRadius: 26, style: .continuous)
                .strokeBorder(.white.opacity(0.2), lineWidth: 1)

            KnockerGlyph(ping: ping)
                .frame(width: 54, height: 54)
        }
        .onAppear { ping = true }
    }
}

/// Drawn in a 54×54 space: a door (outline + knob) with two knock waves.
private struct KnockerGlyph: View {
    var ping: Bool

    var body: some View {
        ZStack {
            // Door
            DoorShape()
                .stroke(.white, style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round))
            // Knob
            Circle()
                .fill(.white)
                .frame(width: 4, height: 4)
                .offset(x: 6, y: 1)
            // Knock waves emanating from the knob
            KnockWaves()
                .stroke(.white, style: StrokeStyle(lineWidth: 2, lineCap: .round))
                .opacity(ping ? 0.9 : 0.35)
                .scaleEffect(ping ? 1 : 0.82, anchor: .leading)
                .animation(.easeInOut(duration: 1.6).repeatForever(autoreverses: true), value: ping)
        }
        .frame(width: 54, height: 54)
    }
}

private struct DoorShape: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        // Door panel, left of center to leave room for knock waves
        let door = CGRect(x: rect.minX + 8, y: rect.minY + 6,
                          width: 22, height: rect.height - 12)
        p.addRoundedRect(in: door, cornerSize: CGSize(width: 4, height: 4))
        return p
    }
}

private struct KnockWaves: Shape {
    func path(in rect: CGRect) -> Path {
        var p = Path()
        // Waves centered near the knob, opening to the right
        let center = CGPoint(x: rect.minX + 36, y: rect.midY + 1)
        for r in [CGFloat(7), 12] {
            p.addArc(center: center, radius: r,
                     startAngle: .degrees(-52), endAngle: .degrees(52),
                     clockwise: false)
        }
        return p
    }
}

// MARK: - Territory-map grid backdrop

private struct MapGridBackground: View {
    var body: some View {
        Canvas { ctx, size in
            let step: CGFloat = 46
            var grid = Path()
            var x: CGFloat = 0
            while x <= size.width { grid.move(to: .init(x: x, y: 0)); grid.addLine(to: .init(x: x, y: size.height)); x += step }
            var y: CGFloat = 0
            while y <= size.height { grid.move(to: .init(x: 0, y: y)); grid.addLine(to: .init(x: size.width, y: y)); y += step }
            ctx.stroke(grid, with: .color(.white.opacity(0.035)), lineWidth: 0.5)

            // A couple of faint "route" lines with nodes — the door-to-door path
            let routes: [[CGPoint]] = [
                [.init(x: size.width * 0.12, y: size.height * 0.72),
                 .init(x: size.width * 0.34, y: size.height * 0.66),
                 .init(x: size.width * 0.5,  y: size.height * 0.78),
                 .init(x: size.width * 0.74, y: size.height * 0.7)],
                [.init(x: size.width * 0.2, y: size.height * 0.16),
                 .init(x: size.width * 0.46, y: size.height * 0.24),
                 .init(x: size.width * 0.68, y: size.height * 0.14)]
            ]
            for route in routes {
                var line = Path()
                line.move(to: route[0])
                for pt in route.dropFirst() { line.addLine(to: pt) }
                ctx.stroke(line, with: .color(Color(hex: 0x3B82F6).opacity(0.1)),
                           style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
                for pt in route {
                    let dot = Path(ellipseIn: CGRect(x: pt.x - 1.6, y: pt.y - 1.6, width: 3.2, height: 3.2))
                    ctx.fill(dot, with: .color(Color(hex: 0x3B82F6).opacity(0.22)))
                }
            }
        }
    }
}

// MARK: - Press physics + dark field

private struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.92 : 1)
            .animation(.spring(response: 0.3, dampingFraction: 0.6), value: configuration.isPressed)
    }
}

private extension View {
    func darkField(active: Bool) -> some View {
        self
            .padding(.horizontal, 16)
            .padding(.vertical, 16)
            .background(Color.white.opacity(active ? 0.09 : 0.06))
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(active ? Color(hex: 0x3B82F6).opacity(0.85) : Color.white.opacity(0.1),
                                  lineWidth: 1.5)
            )
            .shadow(color: active ? Color(hex: 0x3B82F6).opacity(0.18) : .clear, radius: 10, y: 3)
            .animation(.easeOut(duration: 0.18), value: active)
    }
}

// MARK: - Sign-in help sheet
// Honest by design: Knocker accounts are provisioned by the rep's org, and there
// is no self-serve email reset yet (no /auth/forgot-password route + email
// transport not installed). So this routes the rep to the real reset path — their
// team lead resets/re-invites from the Door 2 Digital console — and lets them copy
// their email to send along. No "we emailed you a link" promise that wouldn't fire.

private struct SignInHelpSheet: View {
    let prefillEmail: String
    @Environment(\.dismiss) private var dismiss
    @State private var copied = false

    var body: some View {
        VStack(spacing: 0) {
            // Glyph
            ZStack {
                Circle().fill(Color(hex: 0x3B82F6).opacity(0.16)).frame(width: 60, height: 60)
                Image(systemName: "key.horizontal.fill")
                    .font(.system(size: 24, weight: .medium))
                    .foregroundStyle(Color(hex: 0x60A5FA))
            }
            .padding(.top, 26)
            .padding(.bottom, 16)

            Text("Need help signing in?")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.white)
                .padding(.bottom, 22)

            VStack(spacing: 14) {
                helpRow(
                    icon: "lock.rotation",
                    title: "Forgot your password?",
                    body: "Your team lead can reset it from the Door 2 Digital console — Settings → Team."
                )
                helpRow(
                    icon: "person.badge.plus",
                    title: "No account yet?",
                    body: "Knocker accounts are set up by your team. Ask your team lead to send your invite."
                )
            }
            .padding(.horizontal, 24)

            Spacer(minLength: 12)

            // Copy-email helper so the rep can send it to their manager
            if !prefillEmail.trimmingCharacters(in: .whitespaces).isEmpty {
                Button {
                    UIPasteboard.general.string = prefillEmail.trimmingCharacters(in: .whitespaces).lowercased()
                    withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) { copied = true }
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: copied ? "checkmark" : "doc.on.doc")
                            .font(.system(size: 13, weight: .semibold))
                        Text(copied ? "Email copied" : "Copy my email address")
                            .font(.system(size: 14, weight: .medium))
                    }
                    .foregroundStyle(copied ? Color(hex: 0x60A5FA) : .white.opacity(0.7))
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.white.opacity(0.06))
                    .clipShape(RoundedRectangle(cornerRadius: 13, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 13, style: .continuous)
                        .strokeBorder(Color.white.opacity(0.1), lineWidth: 1))
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 10)
            }

            Button { dismiss() } label: {
                Text("Done")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .frame(height: 52)
                    .background(
                        LinearGradient(colors: [Color(hex: 0x3B82F6), Color(hex: 0x1D4ED8)],
                                       startPoint: .topLeading, endPoint: .bottomTrailing)
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            .buttonStyle(PressableStyle())
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .frame(maxWidth: .infinity)
    }

    private func helpRow(icon: String, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(Color(hex: 0x60A5FA))
                .frame(width: 22, height: 22)
                .padding(.top, 1)
            VStack(alignment: .leading, spacing: 3) {
                Text(title).font(.system(size: 14, weight: .semibold)).foregroundStyle(.white)
                Text(body).font(.system(size: 13)).foregroundStyle(.white.opacity(0.5))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }
}

#Preview {
    LoginView().environment(AppState())
}
