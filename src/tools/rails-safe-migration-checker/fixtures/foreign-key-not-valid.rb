class AddCustomerForeignKey < ActiveRecord::Migration[7.1]
  def change
    add_foreign_key :orders, :customers, validate: false
  end
end
