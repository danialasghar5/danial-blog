class AddCodeToOrders < ActiveRecord::Migration[7.1]
  def change
    add_column :orders, :code, :string, default: -> { "my_code_fn()" }
  end
end
