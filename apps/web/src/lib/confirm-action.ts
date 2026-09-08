import Swal from "sweetalert2";

type ConfirmActionOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
};

export async function confirmAction({
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  tone = "primary",
}: ConfirmActionOptions) {
  const result = await Swal.fire({
    title,
    text: description,
    showCancelButton: true,
    confirmButtonText: confirmLabel,
    cancelButtonText: cancelLabel,
    reverseButtons: true,
    focusCancel: tone === "danger",
    buttonsStyling: false,
    heightAuto: false,
    customClass: {
      container: "infinity-dialog-container",
      popup: "infinity-dialog",
      title: "infinity-dialog__title",
      htmlContainer: "infinity-dialog__description",
      actions: "infinity-dialog__actions",
      confirmButton: `infinity-dialog__button infinity-dialog__button--${tone}`,
      cancelButton: "infinity-dialog__button infinity-dialog__button--cancel",
    },
  });

  return result.isConfirmed;
}
