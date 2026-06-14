// CameraCaptureView.swift — UIImagePickerController bridge for capturing a home photo.
// Camera-first with a static availability check so callers can fall back to the
// PhotosPicker library on the simulator (where .camera is unavailable).

import SwiftUI
import UIKit

struct CameraCaptureView: UIViewControllerRepresentable {
    /// JPEG-encoded image data (compression ~0.7), delivered on capture.
    let onCapture: (Data) -> Void
    var sourceType: UIImagePickerController.SourceType

    @Environment(\.dismiss) private var dismiss

    init(
        sourceType: UIImagePickerController.SourceType = .camera,
        onCapture: @escaping (Data) -> Void
    ) {
        self.sourceType = sourceType
        self.onCapture = onCapture
    }

    /// True only on real hardware with an available camera. Use this to decide
    /// whether to present CameraCaptureView (.camera) or a PhotosPicker fallback.
    static var isCameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        // Guard against an unavailable source (e.g. .camera on the simulator)
        // so we never present a broken controller.
        picker.sourceType = UIImagePickerController.isSourceTypeAvailable(sourceType)
            ? sourceType
            : .photoLibrary
        picker.allowsEditing = false
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(onCapture: onCapture, dismiss: dismiss)
    }

    // MARK: - Coordinator

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        private let onCapture: (Data) -> Void
        private let dismiss: DismissAction

        init(onCapture: @escaping (Data) -> Void, dismiss: DismissAction) {
            self.onCapture = onCapture
            self.dismiss = dismiss
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            let image = (info[.editedImage] as? UIImage) ?? (info[.originalImage] as? UIImage)
            if let data = image?.jpegData(compressionQuality: 0.7) {
                onCapture(data)
            }
            dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            dismiss()
        }
    }
}
