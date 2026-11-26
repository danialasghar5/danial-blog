class RenameInvoices < ActiveRecord::Migration[7.1]
  def change
    rename_table :invoices, :billing_invoices
  end
end
