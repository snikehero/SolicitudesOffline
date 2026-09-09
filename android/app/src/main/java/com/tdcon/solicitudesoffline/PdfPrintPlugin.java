package com.tdcon.solicitudesoffline;

import android.content.Context;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.print.PageRange;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PrintManager;
import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.FileOutputStream;
import java.io.IOException;

@CapacitorPlugin(name = "PdfPrint")
public class PdfPrintPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        String data = call.getString("data");
        String jobName = call.getString("jobName", "Solicitud TDCON");
        if (data == null || data.isEmpty()) {
            call.reject("PDF data is required.");
            return;
        }

        final byte[] pdfBytes;
        try {
            pdfBytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException exception) {
            call.reject("PDF data is not valid Base64.", null, exception);
            return;
        }

        getActivity().runOnUiThread(() -> {
            PrintManager printManager =
                (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
            if (printManager == null) {
                call.reject("Android printing is not available.");
                return;
            }
            printManager.print(jobName, new PdfAdapter(jobName, pdfBytes), null);
            call.resolve();
        });
    }

    private static final class PdfAdapter extends PrintDocumentAdapter {
        private final String documentName;
        private final byte[] pdfBytes;

        private PdfAdapter(String documentName, byte[] pdfBytes) {
            this.documentName = documentName;
            this.pdfBytes = pdfBytes;
        }

        @Override
        public void onLayout(
            PrintAttributes oldAttributes,
            PrintAttributes newAttributes,
            CancellationSignal cancellationSignal,
            LayoutResultCallback callback,
            Bundle extras
        ) {
            if (cancellationSignal.isCanceled()) {
                callback.onLayoutCancelled();
                return;
            }
            PrintDocumentInfo info = new PrintDocumentInfo.Builder(documentName + ".pdf")
                .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
                .setPageCount(PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
                .build();
            callback.onLayoutFinished(info, true);
        }

        @Override
        public void onWrite(
            PageRange[] pages,
            ParcelFileDescriptor destination,
            CancellationSignal cancellationSignal,
            WriteResultCallback callback
        ) {
            if (cancellationSignal.isCanceled()) {
                callback.onWriteCancelled();
                return;
            }
            try (FileOutputStream output = new FileOutputStream(destination.getFileDescriptor())) {
                output.write(pdfBytes);
                callback.onWriteFinished(new PageRange[] { PageRange.ALL_PAGES });
            } catch (IOException exception) {
                callback.onWriteFailed(exception.getMessage());
            }
        }
    }
}
