// LoginView.swift — email + password login screen.
// No SSO button yet (Phase 1.1 wires the SAML SSO via ASWebAuthenticationSession).

import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = AuthViewModel()
    @FocusState private var focus: Field?

    enum Field { case email, password }

    var body: some View {
        ZStack {
            D2DColor.paper.ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                // Logo + wordmark
                VStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(D2DColor.accent)
                            .frame(width: 64, height: 64)
                        Image(systemName: "map.fill")
                            .font(.system(size: 26, weight: .semibold))
                            .foregroundStyle(.white)
                    }
                    Text("Knocker iOS")
                        .font(.system(size: 28, weight: .bold))
                        .foregroundStyle(D2DColor.ink)
                    Text("Door 2 Digital field app")
                        .font(.system(size: 14))
                        .foregroundStyle(D2DColor.muted)
                }
                .padding(.bottom, 48)

                // Form card
                VStack(spacing: 16) {
                    // Email
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Email")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(D2DColor.ink2)
                        TextField("knocker@d2d.io", text: $viewModel.email)
                            .keyboardType(.emailAddress)
                            .textContentType(.emailAddress)
                            .autocorrectionDisabled()
                            .textInputAutocapitalization(.never)
                            .focused($focus, equals: .email)
                            .submitLabel(.next)
                            .onSubmit { focus = .password }
                            .fieldStyle()
                    }

                    // Password
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Password")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(D2DColor.ink2)
                        SecureField("••••••••", text: $viewModel.password)
                            .textContentType(.password)
                            .focused($focus, equals: .password)
                            .submitLabel(.go)
                            .onSubmit { Task { await viewModel.login(appState: appState) } }
                            .fieldStyle()
                    }

                    // Error
                    if let err = viewModel.errorMessage {
                        HStack(spacing: 6) {
                            Image(systemName: "exclamationmark.circle.fill")
                                .foregroundStyle(D2DColor.danger)
                            Text(err)
                                .font(.system(size: 13))
                                .foregroundStyle(D2DColor.danger)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }

                    // Sign in button
                    Button {
                        focus = nil
                        Task { await viewModel.login(appState: appState) }
                    } label: {
                        HStack {
                            if viewModel.isLoading {
                                ProgressView()
                                    .tint(.white)
                                    .scaleEffect(0.85)
                            } else {
                                Text("Sign in")
                                    .font(.system(size: 16, weight: .semibold))
                                    .foregroundStyle(.white)
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .frame(height: 52)
                        .background(D2DColor.accent, in: RoundedRectangle(cornerRadius: D2DRadius.md))
                    }
                    .disabled(viewModel.isLoading)
                }
                .padding(D2DSpacing.lg)
                .background(D2DColor.surface)
                .clipShape(RoundedRectangle(cornerRadius: D2DRadius.xl))
                .shadow(color: D2DColor.ink.opacity(0.06), radius: 20, y: 4)
                .padding(.horizontal, D2DSpacing.md)

                Spacer()

                // Footer
                Text("Knocker iOS v\(Config.appVersion)")
                    .font(.system(size: 11))
                    .foregroundStyle(D2DColor.soft)
                    .padding(.bottom, 24)
            }
        }
    }
}

// MARK: - Field style

private extension View {
    func fieldStyle() -> some View {
        self
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(D2DColor.paper)
            .clipShape(RoundedRectangle(cornerRadius: D2DRadius.md))
            .overlay(
                RoundedRectangle(cornerRadius: D2DRadius.md)
                    .strokeBorder(D2DColor.line, lineWidth: 1)
            )
    }
}

#Preview {
    LoginView()
        .environment(AppState())
}
