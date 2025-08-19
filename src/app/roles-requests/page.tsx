'use client'

import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import { useSidebar } from '../context/SidebarContext'
import Header from '../components/Header'
import Spinner from '../components/Spinner'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Swal from 'sweetalert2'
import axios from 'axios'

interface User {
  _id: string
  name: string
  email: string
  status: number
  role: string
  createdAt: string
}

export default function Page() {
  const [totalUsers, setTotalUsers] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingTable, setLoadingTable] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const router = useRouter()

  useEffect(() => {
    const token = localStorage.getItem('token')

    if (!token) {
      router.push('/admin-login')
      return
    }

    const decodeJwt = (token: string) => {
      const base64Url = token.split('.')[1]
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      )
      return JSON.parse(jsonPayload)
    }

    const decodedToken = decodeJwt(token)
    const currentTime = Date.now() / 1000

    if (decodedToken.exp < currentTime) {
      localStorage.removeItem('token')
      router.push('/admin-login')
      return
    }

    if (decodedToken.role !== 'admin') {
      router.push('/extracted-data-monitoring')
      return
    }

    setIsAuthenticated(true)
    setLoadingTable(false)
  }, [router])

  const { isExpanded } = useSidebar()

  const handleSidebarStateChange = (newState: boolean) => {
    // setIsSidebarExpanded(newState);
    return newState
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
  }

  const fetchUsers = useCallback(async () => {
    try {
      setLoadingTable(true)

      const searchParam = searchQuery
        ? `&search=${encodeURIComponent(searchQuery)}`
        : ''
      const response = await fetch(
        `/api/role-requests/get-requests/?page=${currentPage}${searchParam}`,
      )

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
        setTotalPages(data.totalPages)
        setTotalUsers(data.totalUsers)
      } else {
        console.log('Failed to fetch users')
      }
    } catch (error) {
      console.log('Error fetching users:', error)
    } finally {
      setLoadingTable(false)
    }
  }, [currentPage, searchQuery])

  const updateStatus = async (userId: string, newStatus: number) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: `You are about to change the status to ${
          newStatus === 1 ? 'Accepted' : 'Rejected'
        }.`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, proceed!',
        cancelButtonText: 'No, cancel',
      })

      if (result.isConfirmed) {
        const response = await fetch(`/api/role-requests/update-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, status: newStatus }),
        })

        if (response.ok) {
          setUsers((prevUsers) =>
            prevUsers.map((user) =>
              user._id === userId ? { ...user, status: newStatus } : user,
            ),
          )
          Swal.fire(
            'Updated!',
            `The status has been updated to ${
              newStatus === 1 ? 'Accepted' : 'Rejected'
            }.`,
            'success',
          )
        } else {
          Swal.fire('Error!', 'Failed to update status', 'error')
        }
      }
    } catch (error) {
      console.log('Error updating status:', error)
      Swal.fire(
        'Error!',
        'Something went wrong. Please try again later.',
        'error',
      )
    }
  }

  const deleteUser = async (userId: string) => {
    try {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'You are about to delete this user.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, proceed!',
        cancelButtonText: 'No, cancel',
      })
      if (result.isConfirmed) {
        const response = await axios.delete(
          `/api/role-requests/delete-user/${userId}`,
        )
        if (response.status === 200) {
          setUsers((prevUsers) =>
            prevUsers.filter((user) => user._id !== userId),
          )
          Swal.fire('Deleted!', `User deleted successfully.`, 'success')
        }
      }
    } catch (error) {
      console.log('Error deleting user:', error)
      Swal.fire(
        'Error!',
        'Something went wrong. Please try again later.',
        'error',
      )
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [currentPage, fetchUsers, searchQuery])

  if (!isAuthenticated) return <p>Access Denied. Redirecting...</p>

  return (
    <div className="flex flex-row h-screen bg-white">
      <Sidebar onStateChange={handleSidebarStateChange} />
      <div
        className={`flex-1 flex flex-col transition-all bg-white duration-300 ${
          !isExpanded ? 'ml-24' : 'ml-64'
        }`}
      >
        <Header
          leftContent="Role Requests"
          totalContent={totalUsers}
          rightContent={
            <input
              type="text"
              placeholder="Search user..."
              className="px-4 py-2 rounded-lg border border-gray-300"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          }
          buttonContent={''}
        />
        <div className="flex-1 p-4 bg-white">
          {loadingTable ? (
            <div className="flex justify-center items-center">
              <Spinner />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center mt-20">
              <Image
                src="/images/no_request.svg"
                alt="No jobs found"
                width={200}
                height={200}
                priority
                style={{ width: 'auto', height: 'auto' }}
              />
            </div>
          ) : (
            <table className="min-w-full bg-white border-gray-300">
              <thead>
                <tr className="text-xl text-gray-800">
                  <th className="py-2 px-4 border-b text-start font-medium">
                    User Name
                  </th>
                  <th className="py-2 px-4 border-b text-center font-medium">
                    Request For
                  </th>
                  <th className="py-2 px-4 border-b text-center font-medium">
                    Requested On
                  </th>
                  <th className="py-2 px-4 border-b text-center font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user: User) => (
                  <tr key={user._id} className="text-gray-600">
                    <td className="py-1 px-4 border-b text-start text-lg font-medium">
                      <div className="flex flex-col">
                        <span className="font-semibold text-gray-800">
                          {user.name}
                        </span>
                        <span className=" text-gray-500">{user.email}</span>
                      </div>
                    </td>
                    <td className="py-1 px-4 border-b text-center text-gray-500">
                      {user.role === 'standarduser'
                        ? 'Standard User'
                        : user.role.charAt(0).toUpperCase() +
                          user.role.slice(1).toLowerCase()}
                    </td>

                    <td className="py-1 px-4 border-b text-center text-gray-500">
                      {new Date(user.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </td>
                    <td className="py-1 px-4 border-b text-center">
                      {user.status === 1 ? (
                        <div>
                          <div className="flex gap-2 justify-center">
                            <span className="text-green-500 font-medium bg-green-200 px-3 py-1 rounded-md">
                              Accepted
                            </span>
                            <button
                              onClick={() => deleteUser(user._id)}
                              className="px-5 py-1 text-white bg-red-500 hover:bg-red-600 rounded-md"
                              // aria-label={`Reject request from ${user.name}`}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ) : user.status === 2 ? (
                        <div className="flex gap-2 justify-center">
                          <span className="text-red-500 font-medium bg-red-200 px-3 py-1 rounded-md">
                            Rejected
                          </span>
                          <button
                            onClick={() => deleteUser(user._id)}
                            className="px-5 py-1 text-white bg-red-500 hover:bg-red-600 rounded-md"
                            // aria-label={`Reject request from ${user.name}`}
                          >
                            Delete
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => updateStatus(user._id, 1)}
                            className="mr-2 px-5 py-1 text-white bg-green-500 hover:bg-green-600 rounded-md"
                            aria-label={`Accept request from ${user.name}`}
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => updateStatus(user._id, 2)}
                            className="px-5 py-1 text-white bg-red-500 hover:bg-red-600 rounded-md"
                            aria-label={`Reject request from ${user.name}`}
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {loadingTable || totalPages === 0 || users.length === 0 ? null : (
            <div className="mt-4 flex justify-end items-center gap-4 text-gray-800">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-4 py-2 rounded-md ${
                  currentPage === 1
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Previous
              </button>
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-4 py-2 rounded-md ${
                  currentPage === totalPages
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
