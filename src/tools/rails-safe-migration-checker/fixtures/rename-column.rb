class RenameUserName < ActiveRecord::Migration[7.1]
  def change
    rename_column :users, :name, :full_name
  end
end
